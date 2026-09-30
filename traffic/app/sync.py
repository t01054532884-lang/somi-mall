"""쇼핑몰 데이터 가져오기: 연동 API 동기화 또는 관리자 화면 CSV 업로드."""

import csv
import io
import sqlite3

import requests

from .db import normalize_timestamp, utc_now


def _to_int(value, default: int | None = 0) -> int | None:
    text = str(value if value is not None else "").replace(",", "").strip()
    if not text:
        return default
    try:
        return int(float(text))
    except ValueError:
        return default


def _cell(value: str | None) -> str:
    # 쇼핑몰 CSV 내보내기는 수식 방지용으로 =, +, -, @ 앞에 '를 붙인다.
    text = (value or "").strip()
    if len(text) > 1 and text[0] == "'" and text[1] in "=+-@":
        return text[1:]
    return text


def upsert_products(conn: sqlite3.Connection, products: list[dict]) -> int:
    for product in products:
        price = _to_int(product.get("price"), None)
        conn.execute(
            """INSERT INTO products (id, name, brand, category, price, stock, active, updated_at)
               VALUES (?, ?, ?, ?, COALESCE(?, 0), ?, ?, ?)
               ON CONFLICT (id) DO UPDATE SET
                 name = excluded.name, brand = excluded.brand, category = excluded.category,
                 price = CASE WHEN ? IS NULL THEN products.price ELSE excluded.price END,
                 stock = COALESCE(excluded.stock, products.stock),
                 active = excluded.active, updated_at = excluded.updated_at""",
            (
                str(product["id"]),
                str(product.get("name") or product["id"]),
                str(product.get("brand") or ""),
                str(product.get("category") or ""),
                price,
                _to_int(product.get("stock"), None),
                1 if product.get("active", True) not in (0, "0", False, "false") else 0,
                utc_now(),
                price,
            ),
        )
    return len(products)


def upsert_sale(conn: sqlite3.Connection, order_number: str, ordered_at: str, status: str, item: dict) -> None:
    quantity = _to_int(item.get("quantity"), 0)
    unit_price = _to_int(item.get("unitPrice"), 0)
    conn.execute(
        """INSERT INTO sales (order_number, product_id, product_name, option_name, quantity,
                              unit_price, line_total, status, ordered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (order_number, product_id, option_name) DO UPDATE SET
             product_name = excluded.product_name, quantity = excluded.quantity,
             unit_price = excluded.unit_price, line_total = excluded.line_total,
             status = excluded.status, ordered_at = excluded.ordered_at""",
        (
            order_number,
            str(item["productId"]),
            str(item.get("productName") or ""),
            str(item.get("optionName") or "기본"),
            quantity,
            unit_price,
            _to_int(item.get("lineTotal"), quantity * unit_price),
            status,
            normalize_timestamp(ordered_at),
        ),
    )
    # 상품 목록을 아직 못 받았어도 판매 분석은 되도록 이름만 먼저 등록한다 (재고는 미확인).
    conn.execute(
        "INSERT OR IGNORE INTO products (id, name, price, stock) VALUES (?, ?, ?, NULL)",
        (str(item["productId"]), str(item.get("productName") or item["productId"]), unit_price),
    )


def upsert_orders(conn: sqlite3.Connection, orders: list[dict]) -> int:
    count = 0
    for order in orders:
        for item in order.get("items", []):
            upsert_sale(conn, str(order["orderNumber"]), order.get("createdAt", ""), order.get("status", ""), item)
            count += 1
    return count


def sync_from_mall(conn: sqlite3.Connection, url: str, token: str) -> tuple[int, int]:
    response = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    response.raise_for_status()
    data = response.json()
    products = upsert_products(conn, data.get("products", []))
    lines = upsert_orders(conn, data.get("orders", []))
    return products, lines


def _read_csv(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text.lstrip("﻿"))))


def import_orders_csv(conn: sqlite3.Connection, text: str) -> int:
    """소미몰 관리자 > 주문 CSV 내보내기 파일을 그대로 읽는다."""
    rows = _read_csv(text)
    required = {"주문번호", "주문일시", "상품ID", "수량"}
    if not rows or not required.issubset(rows[0].keys()):
        raise ValueError("주문 CSV에 주문번호, 주문일시, 상품ID, 수량 열이 있어야 합니다.")
    for row in rows:
        upsert_sale(
            conn,
            _cell(row["주문번호"]),
            _cell(row["주문일시"]),
            _cell(row.get("주문상태")),
            {
                "productId": _cell(row["상품ID"]),
                "productName": _cell(row.get("상품명")),
                "optionName": _cell(row.get("옵션")) or "기본",
                "quantity": _cell(row["수량"]),
                "unitPrice": _cell(row.get("단가")),
                "lineTotal": _cell(row.get("상품금액")) or None,
            },
        )
    return len(rows)


def import_products_csv(conn: sqlite3.Connection, text: str) -> int:
    """상품ID, 상품명, 판매가, 재고 열이 있는 CSV (엑셀·구글 시트에서 저장한 파일)."""
    rows = _read_csv(text)
    if not rows or "상품ID" not in rows[0] or "재고" not in rows[0]:
        raise ValueError("상품 CSV에 상품ID, 재고 열이 있어야 합니다.")
    products = [
        {
            "id": _cell(row["상품ID"]),
            "name": _cell(row.get("상품명")) or _cell(row["상품ID"]),
            "brand": _cell(row.get("브랜드")),
            "category": _cell(row.get("카테고리")),
            "price": _cell(row.get("판매가")),
            "stock": _cell(row["재고"]),
        }
        for row in rows
        if _cell(row["상품ID"])
    ]
    return upsert_products(conn, products)
