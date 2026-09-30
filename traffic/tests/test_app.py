import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

_tmp = tempfile.TemporaryDirectory()
os.environ["DATABASE_PATH"] = str(Path(_tmp.name) / "test.db")
os.environ["ADMIN_PASSWORD"] = "test-password"
os.environ["CRON_TOKEN"] = "cron-secret"
os.environ.pop("ALLOWED_ORIGINS", None)
os.environ.pop("MALL_EXPORT_URL", None)

from starlette.testclient import TestClient  # noqa: E402

from app import analytics, pricing, sample, sync  # noqa: E402
from app.db import db, init_db  # noqa: E402
from app.main import app  # noqa: E402


def ago(days: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


def reset():
    init_db()
    with db() as conn:
        for table in ("purchase_orders", "price_history", "supplier_items", "suppliers", "sales", "products", "events"):
            conn.execute(f"DELETE FROM {table}")


class ReorderPlanTest(unittest.TestCase):
    def setUp(self):
        reset()

    def test_fast_seller_gets_reorder_quantity(self):
        with db() as conn:
            conn.execute("INSERT INTO products (id, name, price, stock) VALUES ('p1', '트렌치', 89000, 5)")
            # 30일 동안 하루 1개씩, 최근 7일은 하루 2개씩
            for day in range(30):
                qty = 2 if day < 7 else 1
                conn.execute(
                    "INSERT INTO sales (order_number, product_id, quantity, unit_price, line_total, status, ordered_at) VALUES (?, 'p1', ?, 89000, ?, '배송완료', ?)",
                    (f"O{day}", qty, qty * 89000, ago(day + 0.1)),
                )
            plan = analytics.reorder_plan(conn)
        row = plan[0]
        self.assertEqual(row["units7"], 14)
        self.assertEqual(row["units30"], 37)
        # 0.6*14/7 + 0.4*37/30 = 1.6933
        self.assertAlmostEqual(row["velocity"], 1.6933, places=3)
        self.assertEqual(row["status"], "발주 필요")
        # 기본 입고 7일 + 안전 5일 + 채울 21일 = 33일치 - 재고 5
        self.assertEqual(row["quantity"], 51)

    def test_cancelled_orders_and_incoming_stock_are_respected(self):
        with db() as conn:
            conn.execute("INSERT INTO products (id, name, price, stock) VALUES ('p1', '코트', 100000, 2)")
            for day in range(7):
                conn.execute(
                    "INSERT INTO sales (order_number, product_id, quantity, status, ordered_at) VALUES (?, 'p1', 1, '배송완료', ?)",
                    (f"O{day}", ago(day + 0.1)),
                )
            conn.execute(
                "INSERT INTO sales (order_number, product_id, quantity, status, ordered_at) VALUES ('X', 'p1', 50, '취소', ?)",
                (ago(1),),
            )
            conn.execute("INSERT INTO purchase_orders (product_id, quantity) VALUES ('p1', 100)")
            row = analytics.reorder_plan(conn)[0]
        self.assertEqual(row["units7"], 7)
        self.assertEqual(row["on_order"], 100)
        self.assertEqual(row["quantity"], 0)

    def test_cheapest_supplier_sets_lead_time_and_moq(self):
        with db() as conn:
            conn.execute("INSERT INTO settings (key, value) VALUES ('fx_CNY', '200') ON CONFLICT (key) DO UPDATE SET value = excluded.value")
            conn.execute("INSERT INTO products (id, name, price, stock) VALUES ('p1', '가디건', 49000, 0)")
            cn = conn.execute("INSERT INTO suppliers (name, currency, lead_days, shipping_per_unit, duty_rate) VALUES ('CN', 'CNY', 14, 2000, 10)").lastrowid
            kr = conn.execute("INSERT INTO suppliers (name, currency, lead_days) VALUES ('KR', 'KRW', 2)").lastrowid
            a = conn.execute("INSERT INTO supplier_items (supplier_id, product_id, title, min_order_qty) VALUES (?, 'p1', 'cn', 10)", (cn,)).lastrowid
            b = conn.execute("INSERT INTO supplier_items (supplier_id, product_id, title) VALUES (?, 'p1', 'kr')", (kr,)).lastrowid
            pricing.record_price(conn, a, 70, "manual")  # 70*200 = 14000 + 10% + 2000 = 17400
            pricing.record_price(conn, b, 21000, "manual")
            conn.execute("INSERT INTO sales (order_number, product_id, quantity, status, ordered_at) VALUES ('O1', 'p1', 1, '배송완료', ?)", (ago(1),))
            items = {i["title"]: i for i in pricing.supplier_items_view(conn)}
            row = analytics.reorder_plan(conn)[0]
        self.assertEqual(items["cn"]["cost_krw"], 17400)
        self.assertTrue(items["cn"]["is_cheapest"])
        self.assertAlmostEqual(items["cn"]["margin_pct"], (49000 - 17400) / 49000 * 100)
        self.assertEqual(row["status"], "품절")
        self.assertEqual(row["lead_days"], 14)
        self.assertEqual(row["quantity"], 10)  # 계산값이 최소 주문 수량보다 작으면 최소 수량


class PriceExtractionTest(unittest.TestCase):
    def test_json_ld_offer(self):
        html = '<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"128.50","priceCurrency":"CNY"}}</script>'
        self.assertEqual(pricing.extract_price(html), (128.5, "CNY"))

    def test_meta_tags(self):
        html = '<meta content="32,000" property="product:price:amount"><meta property="product:price:currency" content="KRW">'
        self.assertEqual(pricing.extract_price(html), (32000.0, "KRW"))

    def test_missing_price(self):
        self.assertIsNone(pricing.extract_price("<html><body>로그인 후 가격 확인</body></html>"))


class ImportTest(unittest.TestCase):
    def setUp(self):
        reset()

    def test_mall_order_csv_export(self):
        header = "주문번호,주문일시,주문상태,결제상태,주문자,이메일,수령인,연락처,주소,배송메모,상품ID,상품명,옵션,수량,단가,상품금액,할인,배송비,최종금액,택배사,운송장번호"
        line = '"SM1","2026-09-29 03:00:00","배송완료","","홍","a@b.c","홍","010","서울","","abc","트렌치","베이지","2","89000","178000","0","0","178000","로젠택배",""'
        text = "﻿" + header + "\r\n" + line + "\r\n" + line.replace('"배송완료"', '"취소"', 1)
        with db() as conn:
            sync.import_orders_csv(conn, text)
            rows = conn.execute("SELECT * FROM sales").fetchall()
            product = conn.execute("SELECT * FROM products WHERE id = 'abc'").fetchone()
        self.assertEqual(len(rows), 1)  # 같은 주문 줄은 덮어쓴다
        self.assertEqual(rows[0]["status"], "취소")
        self.assertEqual(rows[0]["line_total"], 178000)
        self.assertIsNone(product["stock"])  # 주문만으로는 재고를 모른다
        # 개인정보 열은 저장하지 않는다
        self.assertNotIn("recipient", rows[0].keys())

    def test_product_csv_keeps_price_when_column_missing(self):
        with db() as conn:
            sync.upsert_products(conn, [{"id": "abc", "name": "트렌치", "price": 89000, "stock": 3}])
            sync.import_products_csv(conn, "상품ID,재고\nabc,12\n")
            product = conn.execute("SELECT * FROM products WHERE id = 'abc'").fetchone()
        self.assertEqual(product["stock"], 12)
        self.assertEqual(product["price"], 89000)

    def test_bad_csv_is_rejected(self):
        with db() as conn, self.assertRaises(ValueError):
            sync.import_orders_csv(conn, "a,b\n1,2\n")


class WebTest(unittest.TestCase):
    def setUp(self):
        reset()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def login(self):
        response = self.client.post("/login", data={"password": "test-password"}, follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/")

    def test_pages_require_login(self):
        response = self.client.get("/", follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/login")
        self.assertEqual(self.client.post("/login", data={"password": "nope"}, follow_redirects=False).headers["location"], "/login?msg=login_failed")

    def test_all_pages_render_with_sample_data(self):
        self.login()
        self.assertEqual(self.client.get("/").status_code, 200)  # 빈 상태
        self.client.post("/data/demo/load")
        for path in ("/", "/?days=7", "/?days=90", "/inventory", "/suppliers", "/data", "/settings"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertNotIn("Traceback", response.text)
        csv_text = self.client.get("/inventory/reorder.csv").text
        self.assertIn("발주 추천 수량", csv_text)
        self.client.post("/data/demo/clear")
        with db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM products").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0], 0)

    def test_supplier_item_and_purchase_order_flow(self):
        self.login()
        with db() as conn:
            conn.execute("INSERT INTO products (id, name, price, stock) VALUES ('p1', '트렌치', 89000, 1)")
        self.client.post("/suppliers", data={"name": "동대문", "currency": "KRW", "lead_days": "2"})
        with db() as conn:
            supplier_id = conn.execute("SELECT id FROM suppliers").fetchone()[0]
        self.client.post("/items", data={"supplier_id": supplier_id, "product_id": "p1", "title": "트렌치 도매", "price": "35000"})
        with db() as conn:
            item_id = conn.execute("SELECT id FROM supplier_items").fetchone()[0]
        self.client.post(f"/items/{item_id}/price", data={"price": "33000"})
        response = self.client.post("/inventory/po", data={"product_id": "p1", "supplier_item_id": item_id, "quantity": "10"}, follow_redirects=False)
        self.assertEqual(response.headers["location"], "/inventory?msg=po_created")
        with db() as conn:
            po = conn.execute("SELECT * FROM purchase_orders").fetchone()
            history = conn.execute("SELECT COUNT(*) FROM price_history").fetchone()[0]
        self.assertEqual(po["unit_cost_krw"], 33000)
        self.assertEqual(history, 2)
        self.client.post(f"/inventory/po/{po['id']}/receive")
        with db() as conn:
            self.assertEqual(conn.execute("SELECT status FROM purchase_orders").fetchone()[0], "입고완료")

    def test_cross_site_post_is_blocked(self):
        self.login()
        response = self.client.post("/settings", data={"fx_USD": "1"}, headers={"origin": "https://evil.example"})
        self.assertEqual(response.status_code, 403)

    def test_collect_records_pageview_without_login(self):
        body = json.dumps({
            "type": "pageview", "path": "/product/abc", "host": "somi.example",
            "referrer": "https://www.instagram.com/p/1", "visitor_id": "v1<script>", "session_id": "s1",
        })
        response = self.client.post("/collect", content=body, headers={"content-type": "text/plain", "user-agent": "Mozilla/5.0 (iPhone)"})
        self.assertEqual(response.status_code, 204)
        bot = self.client.post("/collect", content=body, headers={"user-agent": "Googlebot/2.1"})
        self.assertEqual(bot.status_code, 204)
        self.assertEqual(self.client.post("/collect", content="{}").status_code, 400)
        with db() as conn:
            rows = conn.execute("SELECT * FROM events").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["product_id"], "abc")
        self.assertEqual(rows[0]["referrer"], "instagram.com")
        self.assertEqual(rows[0]["device"], "mobile")
        self.assertEqual(rows[0]["visitor_id"], "v1script")

    def test_internal_referrer_is_dropped(self):
        body = json.dumps({"type": "pageview", "path": "/", "host": "somi.example", "referrer": "https://somi.example/cart", "visitor_id": "v"})
        self.client.post("/collect", content=body)
        with db() as conn:
            self.assertEqual(conn.execute("SELECT referrer FROM events").fetchone()[0], "")

    def test_cron_requires_token(self):
        self.assertEqual(self.client.post("/api/cron/run").status_code, 401)
        response = self.client.post("/api/cron/run", headers={"authorization": "Bearer cron-secret"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["prices_ok"], 0)

    def test_tracker_script_is_public(self):
        response = self.client.get("/t.js")
        self.assertEqual(response.status_code, 200)
        self.assertIn("somiTrack", response.text)


class SampleTest(unittest.TestCase):
    def test_sample_is_idempotent(self):
        reset()
        with db() as conn:
            sample.load_sample(conn)
            first = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
            sample.load_sample(conn)
            second = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
            statuses = {row["status"] for row in analytics.reorder_plan(conn)}
        self.assertEqual(first, second)
        self.assertIn("품절", statuses)
        self.assertIn("발주 필요", statuses)


if __name__ == "__main__":
    unittest.main()
