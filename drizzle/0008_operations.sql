-- 관리자 운영 도구: 도매가 추적, 재고 발주, 방문 분석
CREATE TABLE ops_settings (
  key text PRIMARY KEY NOT NULL,
  value real NOT NULL
);
CREATE TABLE suppliers (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  country text DEFAULT 'KR' NOT NULL,
  currency text DEFAULT 'KRW' NOT NULL,
  site_url text DEFAULT '' NOT NULL,
  lead_days integer DEFAULT 7 NOT NULL,
  shipping_per_unit integer DEFAULT 0 NOT NULL,
  duty_rate real DEFAULT 0 NOT NULL,
  memo text DEFAULT '' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE supplier_items (
  id text PRIMARY KEY NOT NULL,
  supplier_id text NOT NULL,
  product_id text,
  title text NOT NULL,
  url text DEFAULT '' NOT NULL,
  price real,
  min_order_qty integer DEFAULT 1 NOT NULL,
  auto_fetch integer DEFAULT 0 NOT NULL,
  last_checked_at text,
  last_error text DEFAULT '' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_supplier_items_product ON supplier_items (product_id);
CREATE INDEX idx_supplier_items_supplier ON supplier_items (supplier_id);
CREATE TABLE supplier_price_history (
  id text PRIMARY KEY NOT NULL,
  supplier_item_id text NOT NULL,
  price real NOT NULL,
  source text DEFAULT 'manual' NOT NULL,
  checked_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_supplier_price_history_item ON supplier_price_history (supplier_item_id, checked_at);
CREATE TABLE purchase_orders (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL,
  supplier_item_id text,
  quantity integer NOT NULL,
  unit_cost_krw integer DEFAULT 0 NOT NULL,
  status text DEFAULT '발주' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  received_at text
);
CREATE INDEX idx_purchase_orders_product ON purchase_orders (product_id, status);
-- 방문 기록. 개인정보 없이 브라우저별 임의 ID만 저장한다.
CREATE TABLE site_events (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  ts text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  type text DEFAULT 'pageview' NOT NULL,
  path text DEFAULT '/' NOT NULL,
  product_id text,
  referrer text DEFAULT '' NOT NULL,
  utm_source text DEFAULT '' NOT NULL,
  device text DEFAULT 'desktop' NOT NULL,
  visitor_id text DEFAULT '' NOT NULL,
  session_id text DEFAULT '' NOT NULL
);
CREATE INDEX idx_site_events_ts ON site_events (ts);
CREATE INDEX idx_site_events_product ON site_events (product_id, ts);
