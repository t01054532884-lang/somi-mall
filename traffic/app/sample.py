"""쇼핑몰 연동 전에 화면을 미리 볼 수 있는 가을 아우터 샘플 데이터."""

import random
import sqlite3
from datetime import datetime, timedelta, timezone

PREFIX = "demo-"
SUPPLIER_TAG = "[샘플] "

PRODUCTS = [
    # id, 이름, 판매가, 현재 재고, 하루 평균 판매량
    ("demo-trench", "샘플 벨티드 트렌치코트", 89000, 6, 1.4),
    ("demo-cardigan", "샘플 울 블렌드 가디건", 49000, 40, 1.1),
    ("demo-blouson", "샘플 스웨이드 블루종", 79000, 3, 0.7),
    ("demo-jacket", "샘플 크롭 트위드 자켓", 69000, 22, 0.5),
    ("demo-padding", "샘플 경량 숏패딩", 99000, 0, 0.9),
    ("demo-coat", "샘플 핸드메이드 롱코트", 159000, 15, 0.15),
]

SUPPLIERS = [
    # 이름, 국가, 통화, 입고 소요일, 개당 배송비, 관부가세 %
    ("1688 도매 (중국)", "CN", "CNY", 14, 2500, 13),
    ("NETSEA 도매 (일본)", "JP", "JPY", 10, 3000, 13),
    ("동대문 도매 (한국)", "KR", "KRW", 2, 0, 0),
]

# 상품별 (도매처 번호, 최초 도매가, 최소 주문 수량)
ITEMS = {
    "demo-trench": [(0, 138, 5), (2, 36000, 1)],
    "demo-cardigan": [(0, 72, 10), (1, 2200, 3), (2, 21000, 1)],
    "demo-blouson": [(1, 3900, 2), (2, 38000, 1)],
    "demo-jacket": [(0, 115, 5)],
    "demo-padding": [(0, 160, 5), (2, 48000, 1)],
    "demo-coat": [(2, 82000, 1)],
}

REFERRERS = ["", "", "", "instagram.com", "m.search.naver.com", "google.com", "kakao"]


def _ts(moment: datetime) -> str:
    moment = min(moment, datetime.now(timezone.utc))
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def load_sample(conn: sqlite3.Connection, days: int = 60, seed: int = 7) -> None:
    clear_sample(conn)
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)

    for pid, name, price, stock, _ in PRODUCTS:
        conn.execute(
            "INSERT INTO products (id, name, brand, category, price, stock) VALUES (?, ?, '소미 셀렉트', '아우터', ?, ?)",
            (pid, name, price, stock),
        )

    supplier_ids = []
    for name, country, currency, lead, shipping, duty in SUPPLIERS:
        cursor = conn.execute(
            """INSERT INTO suppliers (name, country, currency, lead_days, shipping_per_unit, duty_rate, memo)
               VALUES (?, ?, ?, ?, ?, ?, '샘플 데이터')""",
            (SUPPLIER_TAG + name, country, currency, lead, shipping, duty),
        )
        supplier_ids.append(cursor.lastrowid)

    for pid, entries in ITEMS.items():
        title = next(p[1] for p in PRODUCTS if p[0] == pid).replace("샘플 ", "")
        for supplier_index, base_price, moq in entries:
            digits = 2 if SUPPLIERS[supplier_index][2] == "CNY" else (0 if SUPPLIERS[supplier_index][2] == "JPY" else -2)
            cursor = conn.execute(
                """INSERT INTO supplier_items (supplier_id, product_id, title, price, min_order_qty)
                   VALUES (?, ?, ?, ?, ?)""",
                (supplier_ids[supplier_index], pid, title, base_price, moq),
            )
            price = base_price
            for week in range(8, -1, -1):
                price = round(price * rng.uniform(0.95, 1.06), digits)
                conn.execute(
                    "INSERT INTO price_history (supplier_item_id, price, source, checked_at) VALUES (?, ?, 'manual', ?)",
                    (cursor.lastrowid, price, _ts(now - timedelta(days=week * 7))),
                )
            conn.execute("UPDATE supplier_items SET price = ?, last_checked_at = ? WHERE id = ?", (price, _ts(now), cursor.lastrowid))

    order_no = 0
    for day in range(days, -1, -1):
        date = now - timedelta(days=day)
        season = 0.5 + 0.5 * (days - day) / days  # 가을로 갈수록 아우터 판매 증가
        visitors = int(rng.gauss(140, 25) * season)
        for v in range(max(visitors, 0)):
            vid = f"demo-{day}-{v}"
            moment = date.replace(hour=rng.randint(0, 23), minute=rng.randint(0, 59))
            device = "mobile" if rng.random() < 0.72 else "desktop"
            referrer = rng.choice(REFERRERS)
            paths = ["/"] + [f"/product/{rng.choice(PRODUCTS)[0]}" for _ in range(rng.randint(0, 3))]
            for path in paths:
                conn.execute(
                    """INSERT INTO events (ts, type, path, product_id, referrer, device, visitor_id, session_id)
                       VALUES (?, 'pageview', ?, ?, ?, ?, ?, ?)""",
                    (_ts(moment), path, path.split("/")[-1] if path.startswith("/product/") else None, referrer, device, vid, vid),
                )
            if len(paths) > 1 and rng.random() < 0.25:
                conn.execute(
                    "INSERT INTO events (ts, type, path, device, visitor_id, session_id) VALUES (?, 'add_to_cart', ?, ?, ?, ?)",
                    (_ts(moment), paths[-1], device, vid, vid),
                )
        for pid, name, price, _, daily in PRODUCTS:
            for _ in range(sum(rng.random() < daily * season / 3 for _ in range(3))):
                order_no += 1
                qty = 1 if rng.random() < 0.85 else 2
                status = "반품" if rng.random() < 0.06 else "배송완료"
                conn.execute(
                    """INSERT INTO sales (order_number, product_id, product_name, quantity, unit_price, line_total, status, ordered_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (f"DEMO-{order_no:05d}", pid, name, qty, price, qty * price, status,
                     _ts(date.replace(hour=rng.randint(9, 23), minute=rng.randint(0, 59)))),
                )


def clear_sample(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM purchase_orders WHERE product_id LIKE ?", (PREFIX + "%",))
    conn.execute("DELETE FROM suppliers WHERE name LIKE ?", (SUPPLIER_TAG + "%",))
    conn.execute("DELETE FROM products WHERE id LIKE ?", (PREFIX + "%",))
    conn.execute("DELETE FROM sales WHERE order_number LIKE 'DEMO-%'")
    conn.execute("DELETE FROM events WHERE visitor_id LIKE ?", (PREFIX + "%",))
