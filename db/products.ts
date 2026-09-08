import type { Product } from '@/app/catalog';
import { getD1 } from './index';

export type AdminProduct = Product & {
  active: boolean;
  sortOrder: number;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number;
  image_url: string;
  colors: string;
  badge: string;
  today_dispatch: number;
  active: number;
  sale_status: '판매중' | '품절' | '판매 준비';
  style_tag: '에겐녀' | '테토녀' | '미분류';
  sort_order: number;
};

export async function listStoreProducts(): Promise<Product[]> {
  const result = await getD1()
    .prepare(
      `SELECT id, name, brand, category, price, original_price, image_url,
        colors, badge, today_dispatch, active, sale_status, style_tag, sort_order
       FROM products
       WHERE active = 1
       ORDER BY sort_order DESC, created_at DESC`,
    )
    .all<ProductRow>();
  return result.results.map(toProduct);
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const result = await getD1()
    .prepare(
      `SELECT id, name, brand, category, price, original_price, image_url,
        colors, badge, today_dispatch, active, sale_status, style_tag, sort_order
       FROM products
       ORDER BY sort_order DESC, created_at DESC`,
    )
    .all<ProductRow>();
  return result.results.map((row) => ({
    ...toProduct(row),
    active: row.active === 1,
    sortOrder: row.sort_order,
  }));
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: row.price,
    original: row.original_price,
    image: row.image_url,
    colors: parseColors(row.colors),
    badge: row.badge,
    todayDispatch: row.today_dispatch === 1,
    saleStatus: row.sale_status,
    styleTag: row.style_tag,
    sample: false,
  };
}

function parseColors(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((color): color is string => typeof color === 'string')
      : [];
  } catch {
    return [];
  }
}
