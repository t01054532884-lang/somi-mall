"""도매가 환산과 도매 사이트 가격 자동 확인."""

import json
import re
import sqlite3

import requests

from .db import get_settings, utc_now

USER_AGENT = "Mozilla/5.0 (compatible; SomiTrafficPriceCheck/1.0)"

_LD_JSON = re.compile(
    r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)
_META = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_ATTR = re.compile(r"([\w:-]+)\s*=\s*[\"']([^\"']*)[\"']")
_PRICE_KEYS = ("product:price:amount", "og:price:amount", "price")
_CURRENCY_KEYS = ("product:price:currency", "og:price:currency", "pricecurrency")


def fx_rate(settings: dict[str, float], currency: str) -> float:
    return settings.get(f"fx_{currency.upper()}", 1.0)


def landed_cost(price: float | None, supplier: sqlite3.Row | dict, settings: dict[str, float]) -> int | None:
    """도매가를 원화로 바꾸고 개당 배송비, 관부가세를 더한 실제 매입 원가."""
    if price is None:
        return None
    goods = price * fx_rate(settings, supplier["currency"])
    duty = goods * supplier["duty_rate"] / 100
    return round(goods + duty + supplier["shipping_per_unit"])


def parse_number(text: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", str(text).replace(",", ""))
    if not cleaned or cleaned.count(".") > 1:
        return None
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return value if value > 0 else None


def _find_offer(node):
    if isinstance(node, list):
        for child in node:
            found = _find_offer(child)
            if found:
                return found
        return None
    if not isinstance(node, dict):
        return None
    for key in ("price", "lowPrice"):
        if key in node:
            price = parse_number(node[key])
            if price:
                return price, node.get("priceCurrency")
    for key in ("offers", "@graph", "mainEntity"):
        if key in node:
            found = _find_offer(node[key])
            if found:
                return found
    return None


def extract_price(html: str) -> tuple[float, str | None] | None:
    """상품 페이지 HTML에서 가격을 찾는다. 구조화 데이터(JSON-LD)를 먼저 보고, 없으면 meta 태그를 본다."""
    for block in _LD_JSON.findall(html):
        try:
            found = _find_offer(json.loads(block.strip()))
        except json.JSONDecodeError:
            continue
        if found:
            return found

    price, currency = None, None
    for tag in _META.findall(html):
        attrs = {k.lower(): v for k, v in _ATTR.findall(tag)}
        key = (attrs.get("property") or attrs.get("name") or attrs.get("itemprop") or "").lower()
        if key in _PRICE_KEYS and price is None:
            price = parse_number(attrs.get("content", ""))
        elif key in _CURRENCY_KEYS and currency is None:
            currency = attrs.get("content", "").upper() or None
    if price:
        return price, currency
    return None


def fetch_price(url: str) -> tuple[float, str | None]:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
    response.raise_for_status()
    found = extract_price(response.text)
    if not found:
        raise ValueError("페이지에서 가격 정보를 찾지 못했습니다. 로그인이 필요한 사이트는 직접 입력해 주세요.")
    return found


def record_price(conn: sqlite3.Connection, item_id: int, price: float, source: str) -> None:
    conn.execute(
        "UPDATE supplier_items SET price = ?, last_checked_at = ?, last_error = '' WHERE id = ?",
        (price, utc_now(), item_id),
    )
    conn.execute(
        "INSERT INTO price_history (supplier_item_id, price, source, checked_at) VALUES (?, ?, ?, ?)",
        (item_id, price, source, utc_now()),
    )


def refresh_item(conn: sqlite3.Connection, item: sqlite3.Row) -> bool:
    try:
        price, currency = fetch_price(item["url"])
        if currency and currency != item["currency"]:
            raise ValueError(f"페이지 통화({currency})가 도매처 통화({item['currency']})와 다릅니다.")
    except (requests.RequestException, ValueError) as error:
        conn.execute(
            "UPDATE supplier_items SET last_checked_at = ?, last_error = ? WHERE id = ?",
            (utc_now(), str(error)[:300], item["id"]),
        )
        return False
    record_price(conn, item["id"], price, "auto")
    return True


def refresh_all(conn: sqlite3.Connection) -> tuple[int, int]:
    items = conn.execute(
        """SELECT supplier_items.id, supplier_items.url, suppliers.currency
           FROM supplier_items JOIN suppliers ON suppliers.id = supplier_items.supplier_id
           WHERE supplier_items.auto_fetch = 1 AND supplier_items.url != ''"""
    ).fetchall()
    ok = sum(refresh_item(conn, item) for item in items)
    return ok, len(items) - ok


def supplier_items_view(conn: sqlite3.Connection) -> list[dict]:
    """도매 상품별 원화 원가, 직전 대비 변동률, 연결된 판매가 대비 마진."""
    settings = get_settings(conn)
    rows = conn.execute(
        """SELECT supplier_items.*, suppliers.name AS supplier_name, suppliers.currency,
                  suppliers.country, suppliers.lead_days, suppliers.shipping_per_unit, suppliers.duty_rate,
                  products.name AS product_name, products.price AS sell_price
           FROM supplier_items
           JOIN suppliers ON suppliers.id = supplier_items.supplier_id
           LEFT JOIN products ON products.id = supplier_items.product_id
           ORDER BY products.name IS NULL, products.name, supplier_items.id"""
    ).fetchall()
    history = {}
    for row in conn.execute(
        "SELECT supplier_item_id, price, checked_at FROM price_history ORDER BY checked_at, id"
    ):
        history.setdefault(row["supplier_item_id"], []).append(row["price"])

    items = []
    for row in rows:
        item = dict(row)
        prices = history.get(row["id"], [])
        item["cost_krw"] = landed_cost(row["price"], row, settings)
        item["previous_price"] = prices[-2] if len(prices) >= 2 else None
        item["change_pct"] = (
            (row["price"] - item["previous_price"]) / item["previous_price"] * 100
            if item["previous_price"] and row["price"] is not None
            else None
        )
        item["lowest_price"] = min(prices) if prices else row["price"]
        item["history"] = prices[-20:]
        item["margin_pct"] = (
            (row["sell_price"] - item["cost_krw"]) / row["sell_price"] * 100
            if row["sell_price"] and item["cost_krw"] is not None
            else None
        )
        items.append(item)

    cheapest = {}
    for item in items:
        if item["product_id"] and item["cost_krw"] is not None:
            best = cheapest.get(item["product_id"])
            if best is None or item["cost_krw"] < best["cost_krw"]:
                cheapest[item["product_id"]] = item
    for item in items:
        item["is_cheapest"] = cheapest.get(item["product_id"]) is item
    return items
