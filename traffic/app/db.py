"""SQLite 저장소. Render에서는 DATA_DIR을 영구 디스크 경로로 지정한다."""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 쇼핑몰 상품 스냅샷. stock이 NULL이면 아직 재고 정보를 받지 못한 상품이다.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 주문 상품 한 줄 = 한 행. 같은 주문을 여러 번 가져와도 중복되지 않는다.
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  option_name TEXT NOT NULL DEFAULT '기본',
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '',
  ordered_at TEXT NOT NULL,
  UNIQUE (order_number, product_id, option_name)
);
CREATE INDEX IF NOT EXISTS idx_sales_ordered_at ON sales (ordered_at);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales (product_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'KR',
  currency TEXT NOT NULL DEFAULT 'KRW',
  site_url TEXT NOT NULL DEFAULT '',
  lead_days INTEGER NOT NULL DEFAULT 7,
  shipping_per_unit INTEGER NOT NULL DEFAULT 0,
  duty_rate REAL NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 도매처 상품. product_id로 쇼핑몰 상품과 연결한다.
CREATE TABLE IF NOT EXISTS supplier_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  product_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  price REAL,
  min_order_qty INTEGER NOT NULL DEFAULT 1,
  auto_fetch INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_item_id INTEGER NOT NULL REFERENCES supplier_items (id) ON DELETE CASCADE,
  price REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history (supplier_item_id, checked_at);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  supplier_item_id INTEGER REFERENCES supplier_items (id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_cost_krw INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '발주',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_at TEXT
);

-- 쇼핑몰 방문 기록. 개인정보 없이 브라우저별 임의 ID만 저장한다.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL DEFAULT 'pageview',
  path TEXT NOT NULL DEFAULT '/',
  product_id TEXT,
  referrer TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT 'desktop',
  visitor_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS idx_events_product ON events (product_id);
"""

# 환율은 기본값일 뿐이므로 설정 화면에서 실제 값으로 바꿔 써야 한다.
DEFAULT_SETTINGS = {
    "fx_KRW": "1",
    "fx_CNY": "195",
    "fx_JPY": "9.3",
    "fx_USD": "1400",
    "default_lead_days": "7",
    "safety_days": "5",
    "cover_days": "21",
}

CURRENCIES = ("KRW", "CNY", "JPY", "USD")


def db_path() -> Path:
    if os.environ.get("DATABASE_PATH"):
        return Path(os.environ["DATABASE_PATH"])
    data_dir = os.environ.get("DATA_DIR") or Path(__file__).resolve().parent.parent / "data"
    return Path(data_dir) / "traffic.db"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    db_path().parent.mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript(SCHEMA)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executemany(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            DEFAULT_SETTINGS.items(),
        )


def get_settings(conn: sqlite3.Connection) -> dict[str, float]:
    values = {key: float(value) for key, value in DEFAULT_SETTINGS.items()}
    for row in conn.execute("SELECT key, value FROM settings"):
        try:
            values[row["key"]] = float(row["value"])
        except ValueError:
            pass
    return values


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def normalize_timestamp(value: str) -> str:
    """쇼핑몰 CURRENT_TIMESTAMP, ISO 8601 등 여러 형식을 UTC 'YYYY-MM-DD HH:MM:SS'로 맞춘다."""
    text = (value or "").strip()
    if not text:
        return utc_now()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text[:19]
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.strftime("%Y-%m-%d %H:%M:%S")
