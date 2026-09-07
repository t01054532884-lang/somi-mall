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
    colors: text('colors').notNull().default('[]'),
    badge: text('badge').notNull().default('소미 셀렉트'),
    todayDispatch: integer('today_dispatch', { mode: 'boolean' })
      .notNull()
      .default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_products_name_brand').on(table.name, table.brand),
  ],
);
