ALTER TABLE products ADD description text DEFAULT '' NOT NULL;
ALTER TABLE products ADD detail_images text DEFAULT '[]' NOT NULL;
ALTER TABLE products ADD material text DEFAULT '' NOT NULL;
ALTER TABLE products ADD origin text DEFAULT '' NOT NULL;
ALTER TABLE products ADD manufacturer text DEFAULT '' NOT NULL;
ALTER TABLE products ADD size_chart text DEFAULT '[]' NOT NULL;
ALTER TABLE products ADD seller_name text DEFAULT '' NOT NULL;
ALTER TABLE products ADD seller_representative text DEFAULT '' NOT NULL;
ALTER TABLE products ADD seller_address text DEFAULT '' NOT NULL;
ALTER TABLE products ADD seller_business_number text DEFAULT '' NOT NULL;
ALTER TABLE products ADD seller_mail_order_number text DEFAULT '' NOT NULL;
ALTER TABLE products ADD seller_email text DEFAULT '' NOT NULL;
ALTER TABLE products ADD seller_phone text DEFAULT '' NOT NULL;

CREATE TABLE reviews (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL,
  member_id text NOT NULL,
  member_name text NOT NULL,
  rating integer NOT NULL,
  content text NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX idx_reviews_product_member ON reviews (product_id, member_id);

CREATE TABLE product_inquiries (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL,
  member_id text NOT NULL,
  member_name text NOT NULL,
  content text NOT NULL,
  answer text DEFAULT '' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
