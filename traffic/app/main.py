"""소미몰 운영 대시보드: 매출·트래픽 분석, 재고 발주 추천, 도매가 추적."""

import csv
import hmac
import io
import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

import requests
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, RedirectResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

from . import analytics, auth, pricing, sample, sync
from .db import CURRENCIES, DEFAULT_SETTINGS, db, get_settings, init_db, utc_now

BASE = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=BASE / "templates")

MESSAGES = {
    "login_failed": ("error", "비밀번호가 맞지 않거나 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."),
    "no_password": ("error", "서버에 ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다."),
    "saved": ("ok", "저장했습니다."),
    "deleted": ("ok", "삭제했습니다."),
    "price_saved": ("ok", "도매가를 기록했습니다."),
    "price_fetched": ("ok", "도매 사이트에서 가격을 가져왔습니다."),
    "price_failed": ("error", "가격을 가져오지 못했습니다. 표의 오류 내용을 확인하거나 직접 입력해 주세요."),
    "po_created": ("ok", "발주를 기록했습니다. 입고되면 '입고 완료'를 눌러 주세요."),
    "po_received": ("ok", "입고 완료로 바꿨습니다. 쇼핑몰 관리자 화면에서도 재고를 늘려 주세요."),
    "synced": ("ok", "쇼핑몰 데이터를 동기화했습니다."),
    "sync_missing": ("error", "MALL_EXPORT_URL과 MALL_EXPORT_TOKEN 환경 변수를 먼저 설정해 주세요."),
    "sync_failed": ("error", "쇼핑몰 동기화에 실패했습니다. 주소와 토큰을 확인해 주세요."),
    "imported": ("ok", "CSV를 가져왔습니다."),
    "import_failed": ("error", "CSV 형식이 맞지 않습니다. 열 이름을 확인해 주세요."),
    "demo_loaded": ("ok", "샘플 데이터를 넣었습니다. 실제 데이터를 연결하기 전에 '샘플 삭제'를 눌러 주세요."),
    "demo_cleared": ("ok", "샘플 데이터를 삭제했습니다."),
    "invalid": ("error", "입력값을 확인해 주세요."),
}

PUBLIC_PATHS = ("/login", "/t.js", "/collect", "/healthz", "/static/", "/api/cron/")
BOT_UA = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse", re.IGNORECASE)
EVENT_TYPES = {"pageview", "add_to_cart", "checkout", "purchase"}


def won(value) -> str:
    if value is None:
        return "-"
    return f"{round(value):,}원"


def num(value, digits: int = 0) -> str:
    if value is None:
        return "-"
    return f"{value:,.{digits}f}"


templates.env.filters["won"] = won
templates.env.filters["num"] = num


def render(request: Request, name: str, **context) -> Response:
    message = MESSAGES.get(request.query_params.get("msg", ""))
    return templates.TemplateResponse(request, name, {"message": message, "path": request.url.path, **context})


def back(path: str, msg: str) -> RedirectResponse:
    return RedirectResponse(f"{path}?msg={msg}", status_code=303)


def _float(form, key: str, default: float | None = None) -> float | None:
    try:
        return float(str(form.get(key, "")).replace(",", "").strip())
    except ValueError:
        return default


def _int(form, key: str, default: int = 0) -> int:
    value = _float(form, key)
    return int(value) if value is not None else default


class AdminOnly(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith(PUBLIC_PATHS):
            return await call_next(request)
        if not auth.valid_session(request.cookies.get(auth.COOKIE_NAME)):
            return RedirectResponse("/login", status_code=303)
        origin = request.headers.get("origin")
        if request.method == "POST" and origin and urlparse(origin).netloc != request.url.netloc:
            return Response("다른 사이트에서 보낸 요청은 받을 수 없습니다.", status_code=403)
        return await call_next(request)


# ---------- 로그인 ----------

async def login_page(request: Request):
    return render(request, "login.html", configured=bool(auth.admin_password()))


async def login(request: Request):
    form = await request.form()
    if not auth.admin_password():
        return back("/login", "no_password")
    client = request.client.host if request.client else "unknown"
    if not auth.check_password(str(form.get("password", "")), client):
        return back("/login", "login_failed")
    response = RedirectResponse("/", status_code=303)
    secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    response.set_cookie(
        auth.COOKIE_NAME, auth.make_session(), max_age=auth.SESSION_SECONDS,
        httponly=True, samesite="lax", secure=secure,
    )
    return response


async def logout(request: Request):
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie(auth.COOKIE_NAME)
    return response


# ---------- 대시보드 ----------

def _days(request: Request) -> int:
    try:
        days = int(request.query_params.get("days", 30))
    except ValueError:
        days = 30
    return days if days in (7, 30, 90) else 30


async def dashboard(request: Request):
    days = _days(request)
    with db() as conn:
        plan = analytics.reorder_plan(conn)
        context = {
            "days": days,
            "kpi": analytics.kpis(conn, days),
            "series": analytics.daily_series(conn, days),
            "top": analytics.top_products(conn, days),
            "traffic": analytics.traffic_breakdown(conn, days),
            "alerts": [row for row in plan if row["status"] in ("품절", "발주 필요", "주의")][:6],
            "price_alerts": analytics.price_alerts(conn)[:6],
            "empty": conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0,
        }
    return render(request, "dashboard.html", **context)


# ---------- 재고·발주 ----------

async def inventory(request: Request):
    with db() as conn:
        plan = analytics.reorder_plan(conn)
        orders = conn.execute(
            """SELECT purchase_orders.*, products.name AS product_name, supplier_items.title,
                      suppliers.name AS supplier_name
               FROM purchase_orders
               LEFT JOIN products ON products.id = purchase_orders.product_id
               LEFT JOIN supplier_items ON supplier_items.id = purchase_orders.supplier_item_id
               LEFT JOIN suppliers ON suppliers.id = supplier_items.supplier_id
               ORDER BY purchase_orders.status = '입고완료', purchase_orders.created_at DESC LIMIT 50"""
        ).fetchall()
        settings = get_settings(conn)
    total_cost = sum(row["order_cost"] or 0 for row in plan)
    return render(request, "inventory.html", plan=plan, orders=orders, settings=settings, total_cost=total_cost)


async def reorder_csv(request: Request):
    with db() as conn:
        plan = analytics.reorder_plan(conn)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["상태", "상품ID", "상품명", "현재 재고", "입고 예정", "7일 판매", "30일 판매", "하루 판매량",
                     "재고 소진까지(일)", "발주 추천 수량", "추천 도매처", "도매 상품", "개당 원가(원)", "예상 발주액(원)"])
    for row in plan:
        source = row["source"] or {}
        writer.writerow([
            row["status"], row["product_id"], row["name"], row["stock"] if row["stock"] is not None else "",
            row["on_order"], row["units7"], row["units30"], round(row["velocity"], 2),
            round(row["days_left"], 1) if row["days_left"] is not None else "", row["quantity"],
            source.get("supplier_name", ""), source.get("title", ""), source.get("cost_krw", ""), row["order_cost"] or "",
        ])
    return Response(
        "﻿" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"content-disposition": 'attachment; filename="somi-reorder.csv"'},
    )


async def create_po(request: Request):
    form = await request.form()
    quantity = _int(form, "quantity")
    product_id = str(form.get("product_id", ""))
    if quantity <= 0 or not product_id:
        return back("/inventory", "invalid")
    item_id = _int(form, "supplier_item_id") or None
    with db() as conn:
        cost = 0
        if item_id:
            item = next((i for i in pricing.supplier_items_view(conn) if i["id"] == item_id), None)
            cost = item["cost_krw"] or 0 if item else 0
        conn.execute(
            "INSERT INTO purchase_orders (product_id, supplier_item_id, quantity, unit_cost_krw, created_at) VALUES (?, ?, ?, ?, ?)",
            (product_id, item_id, quantity, cost, utc_now()),
        )
    return back("/inventory", "po_created")


async def update_po(request: Request):
    po_id = request.path_params["po_id"]
    action = request.path_params["action"]
    with db() as conn:
        if action == "receive":
            conn.execute("UPDATE purchase_orders SET status = '입고완료', received_at = ? WHERE id = ?", (utc_now(), po_id))
            return back("/inventory", "po_received")
        conn.execute("DELETE FROM purchase_orders WHERE id = ?", (po_id,))
    return back("/inventory", "deleted")


# ---------- 도매처·가격 추적 ----------

async def suppliers_page(request: Request):
    with db() as conn:
        context = {
            "suppliers": conn.execute(
                """SELECT suppliers.*, COUNT(supplier_items.id) AS item_count FROM suppliers
                   LEFT JOIN supplier_items ON supplier_items.supplier_id = suppliers.id
                   GROUP BY suppliers.id ORDER BY suppliers.name"""
            ).fetchall(),
            "items": pricing.supplier_items_view(conn),
            "products": conn.execute("SELECT id, name FROM products WHERE active = 1 ORDER BY name").fetchall(),
            "settings": get_settings(conn),
        }
    return render(request, "suppliers.html", currencies=CURRENCIES, **context)


async def create_supplier(request: Request):
    form = await request.form()
    name = str(form.get("name", "")).strip()
    currency = str(form.get("currency", "KRW"))
    if not name or currency not in CURRENCIES:
        return back("/suppliers", "invalid")
    with db() as conn:
        conn.execute(
            """INSERT INTO suppliers (name, country, currency, site_url, lead_days, shipping_per_unit, duty_rate, memo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, str(form.get("country", "KR")), currency, str(form.get("site_url", "")).strip(),
             _int(form, "lead_days", 7), _int(form, "shipping_per_unit"), _float(form, "duty_rate", 0) or 0,
             str(form.get("memo", "")).strip()),
        )
    return back("/suppliers", "saved")


async def delete_supplier(request: Request):
    with db() as conn:
        conn.execute("DELETE FROM suppliers WHERE id = ?", (request.path_params["supplier_id"],))
    return back("/suppliers", "deleted")


async def create_item(request: Request):
    form = await request.form()
    title = str(form.get("title", "")).strip()
    supplier_id = _int(form, "supplier_id")
    url = str(form.get("url", "")).strip()
    if not title or not supplier_id or (url and not url.startswith(("http://", "https://"))):
        return back("/suppliers", "invalid")
    price = _float(form, "price")
    with db() as conn:
        cursor = conn.execute(
            """INSERT INTO supplier_items (supplier_id, product_id, title, url, min_order_qty, auto_fetch)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (supplier_id, str(form.get("product_id", "")) or None, title, url,
             max(_int(form, "min_order_qty", 1), 1), 1 if form.get("auto_fetch") and url else 0),
        )
        if price:
            pricing.record_price(conn, cursor.lastrowid, price, "manual")
    return back("/suppliers", "saved")


async def item_action(request: Request):
    item_id = request.path_params["item_id"]
    action = request.path_params["action"]
    with db() as conn:
        if action == "delete":
            conn.execute("DELETE FROM supplier_items WHERE id = ?", (item_id,))
            return back("/suppliers", "deleted")
        if action == "price":
            price = _float(await request.form(), "price")
            if not price or price <= 0:
                return back("/suppliers", "invalid")
            pricing.record_price(conn, int(item_id), price, "manual")
            return back("/suppliers", "price_saved")
        if action == "link":
            product_id = str((await request.form()).get("product_id", "")) or None
            conn.execute("UPDATE supplier_items SET product_id = ? WHERE id = ?", (product_id, item_id))
            return back("/suppliers", "saved")
        item = conn.execute(
            """SELECT supplier_items.id, supplier_items.url, suppliers.currency FROM supplier_items
               JOIN suppliers ON suppliers.id = supplier_items.supplier_id WHERE supplier_items.id = ?""",
            (item_id,),
        ).fetchone()
        ok = bool(item and item["url"]) and pricing.refresh_item(conn, item)
    return back("/suppliers", "price_fetched" if ok else "price_failed")


async def fetch_all_prices(request: Request):
    with db() as conn:
        ok, failed = pricing.refresh_all(conn)
    return back("/suppliers", "price_fetched" if not failed else "price_failed")


# ---------- 데이터 연동 ----------

async def data_page(request: Request):
    with db() as conn:
        stats = {
            "products": conn.execute("SELECT COUNT(*) FROM products").fetchone()[0],
            "sales": conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0],
            "events": conn.execute("SELECT COUNT(*) FROM events").fetchone()[0],
            "last_sale": conn.execute("SELECT MAX(ordered_at) FROM sales").fetchone()[0],
            "last_event": conn.execute("SELECT MAX(ts) FROM events").fetchone()[0],
            "demo": conn.execute("SELECT COUNT(*) FROM products WHERE id LIKE 'demo-%'").fetchone()[0],
        }
    base_url = str(request.base_url).rstrip("/")
    forwarded = request.headers.get("x-forwarded-proto")
    if forwarded:
        base_url = f"{forwarded}://{request.url.netloc}"
    return render(
        request, "data.html", stats=stats, base_url=base_url,
        sync_configured=bool(os.environ.get("MALL_EXPORT_URL") and os.environ.get("MALL_EXPORT_TOKEN")),
    )


async def sync_mall(request: Request):
    url, token = os.environ.get("MALL_EXPORT_URL"), os.environ.get("MALL_EXPORT_TOKEN")
    if not url or not token:
        return back("/data", "sync_missing")
    try:
        with db() as conn:
            sync.sync_from_mall(conn, url, token)
    except (requests.RequestException, ValueError, KeyError):
        return back("/data", "sync_failed")
    return back("/data", "synced")


async def import_csv(request: Request):
    kind = request.path_params["kind"]
    if kind not in ("orders", "products"):
        return back("/data", "import_failed")
    form = await request.form()
    upload = form.get("file")
    if upload is None or not hasattr(upload, "read"):
        return back("/data", "import_failed")
    raw = await upload.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp949", errors="replace")  # 엑셀에서 저장한 CSV
    try:
        with db() as conn:
            if kind == "orders":
                sync.import_orders_csv(conn, text)
            else:
                sync.import_products_csv(conn, text)
    except (ValueError, KeyError):
        return back("/data", "import_failed")
    return back("/data", "imported")


async def demo(request: Request):
    with db() as conn:
        action = request.path_params["action"]
        if action not in ("load", "clear"):
            return back("/data", "invalid")
        if action == "load":
            sample.load_sample(conn)
            return back("/", "demo_loaded")
        sample.clear_sample(conn)
    return back("/data", "demo_cleared")


# ---------- 설정 ----------

async def settings_page(request: Request):
    with db() as conn:
        settings = get_settings(conn)
    return render(request, "settings.html", settings=settings)


async def save_settings(request: Request):
    form = await request.form()
    with db() as conn:
        for key in DEFAULT_SETTINGS:
            value = _float(form, key)
            if value is not None and value >= 0:
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    return back("/settings", "saved")


# ---------- 공개 엔드포인트: 방문 수집, 정기 작업 ----------

def _cors_headers(request: Request) -> dict:
    allowed = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    origin = request.headers.get("origin", "")
    if not allowed:
        return {"Access-Control-Allow-Origin": "*"}
    return {"Access-Control-Allow-Origin": origin} if origin in allowed else {}


async def tracker_js(request: Request):
    return FileResponse(BASE / "static" / "t.js", media_type="application/javascript",
                        headers={"Cache-Control": "public, max-age=3600"})


async def collect(request: Request):
    headers = _cors_headers(request)
    if request.method == "OPTIONS":
        return Response(status_code=204, headers=headers | {"Access-Control-Allow-Headers": "content-type"})
    allowed = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    if allowed and request.headers.get("origin") not in allowed:
        return Response(status_code=403)
    body = await request.body()
    if len(body) > 4000 or BOT_UA.search(request.headers.get("user-agent", "")):
        return Response(status_code=204, headers=headers)
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return Response(status_code=400, headers=headers)
    if not isinstance(data, dict) or data.get("type") not in EVENT_TYPES:
        return Response(status_code=400, headers=headers)

    path = str(data.get("path") or "/")[:300]
    product_id = data.get("product_id")
    match = re.match(r"^/product/([^/?#]+)", path)
    if not product_id and match:
        product_id = match.group(1)
    referrer_host = urlparse(str(data.get("referrer") or "")).netloc.lower().removeprefix("www.")
    if referrer_host and referrer_host == str(data.get("host") or "").lower().removeprefix("www."):
        referrer_host = ""  # 쇼핑몰 안에서 이동한 경우
    clean = lambda key, size: re.sub(r"[^\w.-]", "", str(data.get(key) or ""))[:size]  # noqa: E731
    device = "mobile" if re.search(r"Mobi|Android|iPhone", request.headers.get("user-agent", "")) else "desktop"
    with db() as conn:
        conn.execute(
            """INSERT INTO events (ts, type, path, product_id, referrer, utm_source, device, visitor_id, session_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (utc_now(), data["type"], path, str(product_id)[:80] if product_id else None, referrer_host[:120],
             clean("utm_source", 60), device, clean("visitor_id", 40), clean("session_id", 40)),
        )
    return Response(status_code=204, headers=headers)


async def cron(request: Request):
    """GitHub Actions나 Render Cron Job이 하루 몇 번 호출: 쇼핑몰 동기화 + 도매가 자동 확인."""
    token = os.environ.get("CRON_TOKEN", "")
    given = request.headers.get("authorization", "").removeprefix("Bearer ")
    if not token or not hmac.compare_digest(given, token):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    result = {}
    url, mall_token = os.environ.get("MALL_EXPORT_URL"), os.environ.get("MALL_EXPORT_TOKEN")
    if url and mall_token:
        try:
            with db() as conn:
                result["products"], result["sale_lines"] = sync.sync_from_mall(conn, url, mall_token)
        except (requests.RequestException, ValueError, KeyError) as error:
            result["sync_error"] = str(error)[:200]
    with db() as conn:
        result["prices_ok"], result["prices_failed"] = pricing.refresh_all(conn)
    return JSONResponse(result)


async def healthz(request: Request):
    return JSONResponse({"ok": True})


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


routes = [
    Route("/login", login_page),
    Route("/login", login, methods=["POST"]),
    Route("/logout", logout, methods=["POST"]),
    Route("/", dashboard),
    Route("/inventory", inventory),
    Route("/inventory/reorder.csv", reorder_csv),
    Route("/inventory/po", create_po, methods=["POST"]),
    Route("/inventory/po/{po_id:int}/{action:str}", update_po, methods=["POST"]),
    Route("/suppliers", suppliers_page),
    Route("/suppliers", create_supplier, methods=["POST"]),
    Route("/suppliers/{supplier_id:int}/delete", delete_supplier, methods=["POST"]),
    Route("/suppliers/fetch-all", fetch_all_prices, methods=["POST"]),
    Route("/items", create_item, methods=["POST"]),
    Route("/items/{item_id:int}/{action:str}", item_action, methods=["POST"]),
    Route("/data", data_page),
    Route("/data/sync", sync_mall, methods=["POST"]),
    Route("/data/import/{kind:str}", import_csv, methods=["POST"]),
    Route("/data/demo/{action:str}", demo, methods=["POST"]),
    Route("/settings", settings_page),
    Route("/settings", save_settings, methods=["POST"]),
    Route("/t.js", tracker_js),
    Route("/collect", collect, methods=["POST", "OPTIONS"]),
    Route("/api/cron/run", cron, methods=["POST"]),
    Route("/healthz", healthz),
    Mount("/static", StaticFiles(directory=BASE / "static"), name="static"),
]

app = Starlette(routes=routes, middleware=[Middleware(AdminOnly)], lifespan=lifespan)
