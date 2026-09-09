import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    authProvider: text('auth_provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .notNull()
      .default(false),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    lastLoginAt: text('last_login_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_members_provider_user').on(
      table.authProvider,
      table.providerUserId,
    ),
    uniqueIndex('idx_members_email').on(table.email),
  ],
);

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    category: text('category').notNull(),
    price: integer('price').notNull(),
    originalPrice: integer('original_price').notNull(),
    imageUrl: text('image_url').notNull(),
    description: text('description').notNull().default(''),
    detailImages: text('detail_images').notNull().default('[]'),
    material: text('material').notNull().default(''),
    origin: text('origin').notNull().default(''),
    manufacturer: text('manufacturer').notNull().default(''),
    sizeChart: text('size_chart').notNull().default('[]'),
    sellerName: text('seller_name').notNull().default(''),
    sellerRepresentative: text('seller_representative').notNull().default(''),
    sellerAddress: text('seller_address').notNull().default(''),
    sellerBusinessNumber: text('seller_business_number').notNull().default(''),
    sellerMailOrderNumber: text('seller_mail_order_number').notNull().default(''),
    sellerEmail: text('seller_email').notNull().default(''),
    sellerPhone: text('seller_phone').notNull().default(''),
    colors: text('colors').notNull().default('[]'),
    badge: text('badge').notNull().default('소미 셀렉트'),
    todayDispatch: integer('today_dispatch', { mode: 'boolean' })
      .notNull()
      .default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    saleStatus: text('sale_status').notNull().default('판매중'),
    styleTag: text('style_tag').notNull().default('미분류'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_products_name_brand').on(table.name, table.brand),
  ],
);

export const reviews = sqliteTable('reviews',{
  id:text('id').primaryKey(),productId:text('product_id').notNull(),memberId:text('member_id').notNull(),memberName:text('member_name').notNull(),rating:integer('rating').notNull(),content:text('content').notNull(),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
},(table)=>[uniqueIndex('idx_reviews_product_member').on(table.productId,table.memberId)]);

export const inquiries = sqliteTable('product_inquiries',{
  id:text('id').primaryKey(),productId:text('product_id').notNull(),memberId:text('member_id').notNull(),memberName:text('member_name').notNull(),content:text('content').notNull(),answer:text('answer').notNull().default(''),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
