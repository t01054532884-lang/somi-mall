ALTER TABLE products ADD stock integer DEFAULT 10 NOT NULL;
ALTER TABLE reviews ADD image_url text DEFAULT '' NOT NULL;
ALTER TABLE reviews ADD height_cm integer DEFAULT 0 NOT NULL;
ALTER TABLE reviews ADD weight_kg integer DEFAULT 0 NOT NULL;
ALTER TABLE reviews ADD usual_size text DEFAULT '' NOT NULL;
CREATE TABLE coupons (
  id text PRIMARY KEY NOT NULL,
  member_id text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  discount_rate integer DEFAULT 10 NOT NULL,
  max_discount integer DEFAULT 10000 NOT NULL,
  used integer DEFAULT 0 NOT NULL,
  issued_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  used_at text
);
CREATE UNIQUE INDEX idx_coupons_member_code ON coupons (member_id, code);
CREATE TABLE orders (
  id text PRIMARY KEY NOT NULL,
  order_number text NOT NULL,
  member_id text NOT NULL,
  member_name text NOT NULL,
  email text NOT NULL,
  recipient text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  memo text DEFAULT '' NOT NULL,
  status text DEFAULT '신규 주문' NOT NULL,
  payment_status text DEFAULT '결제수단 미연결' NOT NULL,
  subtotal integer NOT NULL,
  discount integer DEFAULT 0 NOT NULL,
  shipping_fee integer DEFAULT 0 NOT NULL,
  total integer NOT NULL,
  coupon_id text,
  carrier text DEFAULT '로젠택배' NOT NULL,
  tracking_number text DEFAULT '' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_member_created ON orders (member_id, created_at);
CREATE INDEX idx_orders_status ON orders (status);
CREATE TABLE order_items (
  id text PRIMARY KEY NOT NULL,
  order_id text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  option_name text DEFAULT '기본' NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  line_total integer NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);
PRAGMA optimize;
