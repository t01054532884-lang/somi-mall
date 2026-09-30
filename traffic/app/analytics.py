"""매출·트래픽 집계와 재고 발주 계산."""

import math
import sqlite3
from datetime import datetime, timedelta, timezone

from .db import get_settings
from .pricing import supplier_items_view

EXCLUDED_STATUSES = ("취소", "반품")
KST = timezone(timedelta(hours=9))
_VALID_SALE = "status NOT IN ('취소', '반품')"


def _since(days: int, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return (now - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


def _period_totals(conn: sqlite3.Connection, start: str, end: str) -> dict:
    sale = conn.execute(
        f"""SELECT COALESCE(SUM(line_total), 0) AS revenue, COALESCE(SUM(quantity), 0) AS units,
                   COUNT(DISTINCT order_number) AS orders
            FROM sales WHERE ordered_at >= ? AND ordered_at < ? AND {_VALID_SALE}""",
        (start, end),
    ).fetchone()
    traffic = conn.execute(
        """SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
           FROM events WHERE type = 'pageview' AND ts >= ? AND ts < ?""",
        (start, end),
    ).fetchone()
    totals = dict(sale) | dict(traffic)
    totals["aov"] = totals["revenue"] / totals["orders"] if totals["orders"] else 0
    totals["conversion"] = totals["orders"] / totals["visitors"] * 100 if totals["visitors"] else None
    return totals


def kpis(conn: sqlite3.Connection, days: int) -> dict:
    now = datetime.now(timezone.utc)
    end = now.strftime("%Y-%m-%d %H:%M:%S")
    current = _period_totals(conn, _since(days, now), end)
    previous = _period_totals(conn, _since(days * 2, now), _since(days, now))
    for key in ("revenue", "orders", "units", "visitors", "pageviews", "aov"):
        before = previous[key]
        current[f"{key}_delta"] = (current[key] - before) / before * 100 if before else None
    return current


def daily_series(conn: sqlite3.Connection, days: int) -> dict:
    """한국 시간 기준 일별 매출, 주문, 방문자."""
    start = _since(days)
    revenue = {
        row["day"]: row
        for row in conn.execute(
            f"""SELECT date(ordered_at, '+9 hours') AS day, SUM(line_total) AS revenue,
                       COUNT(DISTINCT order_number) AS orders
                FROM sales WHERE ordered_at >= ? AND {_VALID_SALE} GROUP BY day""",
            (start,),
        )
    }
    visitors = {
        row["day"]: row["visitors"]
        for row in conn.execute(
            """SELECT date(ts, '+9 hours') AS day, COUNT(DISTINCT visitor_id) AS visitors
               FROM events WHERE type = 'pageview' AND ts >= ? GROUP BY day""",
            (start,),
        )
    }
    today = datetime.now(KST).date()
    labels, rev, orders, visits = [], [], [], []
    for offset in range(days - 1, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        labels.append(day[5:])
        rev.append(revenue[day]["revenue"] if day in revenue else 0)
        orders.append(revenue[day]["orders"] if day in revenue else 0)
        visits.append(visitors.get(day, 0))
    return {"labels": labels, "revenue": rev, "orders": orders, "visitors": visits}


def top_products(conn: sqlite3.Connection, days: int, limit: int = 10) -> list[dict]:
    start = _since(days)
    rows = conn.execute(
        f"""SELECT sales.product_id, COALESCE(products.name, MAX(sales.product_name)) AS name,
                   SUM(sales.line_total) AS revenue, SUM(sales.quantity) AS units,
                   COUNT(DISTINCT sales.order_number) AS orders, products.stock
            FROM sales LEFT JOIN products ON products.id = sales.product_id
            WHERE sales.ordered_at >= ? AND sales.{_VALID_SALE}
            GROUP BY sales.product_id ORDER BY revenue DESC LIMIT ?""",
        (start, limit),
    ).fetchall()
    viewers = {
        row["product_id"]: row["viewers"]
        for row in conn.execute(
            """SELECT product_id, COUNT(DISTINCT visitor_id) AS viewers FROM events
               WHERE type = 'pageview' AND product_id IS NOT NULL AND ts >= ? GROUP BY product_id""",
            (start,),
        )
    }
    result = []
    for row in rows:
        item = dict(row)
        item["viewers"] = viewers.get(row["product_id"], 0)
        item["conversion"] = item["orders"] / item["viewers"] * 100 if item["viewers"] else None
        result.append(item)
    return result


def traffic_breakdown(conn: sqlite3.Connection, days: int) -> dict:
    start = _since(days)
    sources = conn.execute(
        """SELECT CASE WHEN utm_source != '' THEN utm_source
                       WHEN referrer != '' THEN referrer ELSE '직접 방문' END AS source,
                  COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews
           FROM events WHERE type = 'pageview' AND ts >= ?
           GROUP BY source ORDER BY visitors DESC LIMIT 10""",
        (start,),
    ).fetchall()
    devices = conn.execute(
        """SELECT device, COUNT(DISTINCT visitor_id) AS visitors FROM events
           WHERE type = 'pageview' AND ts >= ? GROUP BY device ORDER BY visitors DESC""",
        (start,),
    ).fetchall()
    pages = conn.execute(
        """SELECT path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors FROM events
           WHERE type = 'pageview' AND ts >= ? GROUP BY path ORDER BY pageviews DESC LIMIT 10""",
        (start,),
    ).fetchall()
    funnel = {
        row["type"]: row["visitors"]
        for row in conn.execute(
            """SELECT type, COUNT(DISTINCT visitor_id) AS visitors FROM events
               WHERE ts >= ? GROUP BY type""",
            (start,),
        )
    }
    return {
        "sources": [dict(r) for r in sources],
        "devices": [dict(r) for r in devices],
        "pages": [dict(r) for r in pages],
        "funnel": funnel,
    }


def reorder_plan(conn: sqlite3.Connection) -> list[dict]:
    """상품별 판매 속도와 재고로 발주 필요 수량을 계산한다.

    하루 판매량 = 최근 7일 평균 60% + 최근 30일 평균 40% (최근 추세를 더 반영).
    발주 시점 = 하루 판매량 × (입고 소요일 + 안전 재고일).
    재고 + 입고 예정이 발주 시점 이하이면, 입고 소요일 + 안전 재고일 + 목표 보유일만큼 채우도록 발주한다.
    """
    settings = get_settings(conn)
    since7, since30 = _since(7), _since(30)
    sold = {
        row["product_id"]: row
        for row in conn.execute(
            f"""SELECT product_id,
                       SUM(CASE WHEN ordered_at >= ? THEN quantity ELSE 0 END) AS units7,
                       SUM(quantity) AS units30
                FROM sales WHERE ordered_at >= ? AND {_VALID_SALE} GROUP BY product_id""",
            (since7, since30),
        )
    }
    incoming = {
        row["product_id"]: row["qty"]
        for row in conn.execute(
            "SELECT product_id, SUM(quantity) AS qty FROM purchase_orders WHERE status = '발주' GROUP BY product_id"
        )
    }
    best_source = {}
    for item in supplier_items_view(conn):
        if item["is_cheapest"]:
            best_source[item["product_id"]] = item

    plan = []
    for product in conn.execute("SELECT * FROM products WHERE active = 1 ORDER BY name"):
        pid = product["id"]
        units7 = sold[pid]["units7"] if pid in sold else 0
        units30 = sold[pid]["units30"] if pid in sold else 0
        velocity = 0.6 * units7 / 7 + 0.4 * units30 / 30
        source = best_source.get(pid)
        lead = source["lead_days"] if source else settings["default_lead_days"]
        safety, cover = settings["safety_days"], settings["cover_days"]
        stock = product["stock"]
        on_order = incoming.get(pid, 0)
        reorder_point = velocity * (lead + safety)
        days_left = stock / velocity if stock is not None and velocity > 0 else None

        quantity = 0
        if stock is None:
            status = "재고 미확인"
        elif velocity == 0:
            status = "품절" if stock <= 0 else "판매 없음"
        else:
            if stock + on_order <= reorder_point:
                target = velocity * (lead + safety + cover)
                quantity = max(math.ceil(target - stock - on_order), source["min_order_qty"] if source else 1)
            if stock <= 0:
                status = "품절"
            elif quantity:
                status = "발주 필요"
            elif days_left is not None and days_left <= (lead + safety) * 1.5:
                status = "주의"
            else:
                status = "정상"

        plan.append(
            {
                "product_id": pid,
                "name": product["name"],
                "price": product["price"],
                "stock": stock,
                "units7": units7,
                "units30": units30,
                "velocity": velocity,
                "days_left": days_left,
                "lead_days": lead,
                "on_order": on_order,
                "reorder_point": math.ceil(reorder_point),
                "quantity": quantity,
                "status": status,
                "source": source,
                "order_cost": quantity * source["cost_krw"] if source and source["cost_krw"] else None,
            }
        )
    urgency = {"품절": 0, "발주 필요": 1, "주의": 2, "재고 미확인": 3, "정상": 4, "판매 없음": 5}
    plan.sort(key=lambda row: (urgency[row["status"]], row["days_left"] if row["days_left"] is not None else 1e9))
    return plan


def price_alerts(conn: sqlite3.Connection, threshold: float = 5.0) -> list[dict]:
    return [
        item
        for item in supplier_items_view(conn)
        if item["change_pct"] is not None and abs(item["change_pct"]) >= threshold
    ]
