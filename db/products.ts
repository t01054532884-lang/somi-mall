import type { Product } from '@/app/catalog';
import { getD1 } from './index';

export type AdminProduct = Product & {
  active: boolean;
  sortOrder: number;
};

type StoreProductRow = {
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

type ProductRow = StoreProductRow & {
  description: string;
  detail_images: string;
  material: string;
  origin: string;
  manufacturer: string;
  size_chart: string;
  seller_name: string;
  seller_representative: string;
  seller_address: string;
  seller_business_number: string;
  seller_mail_order_number: string;
  seller_email: string;
  seller_phone: string;
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
    .all<StoreProductRow>();
  return result.results.map(toStoreProduct);
}

export async function getStoreProduct(id: string): Promise<Product | null> {
  const row = await getD1()
    .prepare(
      `SELECT id, name, brand, category, price, original_price, image_url,
        description, detail_images, material, origin, manufacturer, size_chart,
        seller_name, seller_representative, seller_address, seller_business_number,
        seller_mail_order_number, seller_email, seller_phone,
        colors, badge, today_dispatch, active, sale_status, style_tag, sort_order
       FROM products
       WHERE id = ? AND active = 1`,
    )
    .bind(id)
    .first<ProductRow>();
  return row ? toProduct(row) : null;
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const result = await getD1()
    .prepare(
      `SELECT id, name, brand, category, price, original_price, image_url,
        description, detail_images, material, origin, manufacturer, size_chart,
        seller_name, seller_representative, seller_address, seller_business_number,
        seller_mail_order_number, seller_email, seller_phone,
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

function toStoreProduct(row: StoreProductRow): Product {
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

function toProduct(row: ProductRow): Product {
  return {
    ...toStoreProduct(row),
    description: row.description,
    detailImages: parseArray(row.detail_images),
    material: row.material,
    origin: row.origin,
    manufacturer: row.manufacturer,
    sizeChart: parseSizeChart(row.size_chart),
    seller: {
      name: row.seller_name,
      representative: row.seller_representative,
      address: row.seller_address,
      businessNumber: row.seller_business_number,
      mailOrderNumber: row.seller_mail_order_number,
      email: row.seller_email,
      phone: row.seller_phone,
    },
  };
}

function parseColors(value: string): string[] {
  return parseArray(value);
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((color): color is string => typeof color === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseSizeChart(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type ProductReview = {
  id: string;
  memberName: string;
  rating: number;
  content: string;
  adminReply: string;
  createdAt: string;
};
export async function listProductReviews(
  productId: string,
): Promise<ProductReview[]> {
  const result = await getD1()
    .prepare(
      'SELECT id, member_name, rating, content, admin_reply, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
    )
    .bind(productId)
    .all<{
      id: string;
      member_name: string;
      rating: number;
      content: string;
      admin_reply: string;
      created_at: string;
    }>();
  return result.results.map((r) => ({
    id: r.id,
    memberName: r.member_name,
    rating: r.rating,
    content: r.content,
    adminReply: r.admin_reply,
    createdAt: r.created_at,
  }));
}
export type ProductInquiry = {
  id: string;
  memberName: string;
  content: string;
  answer: string;
  createdAt: string;
};
export async function listProductInquiries(
  productId: string,
): Promise<ProductInquiry[]> {
  const result = await getD1()
    .prepare(
      'SELECT id, member_name, content, answer, created_at FROM product_inquiries WHERE product_id = ? ORDER BY created_at DESC',
    )
    .bind(productId)
    .all<{
      id: string;
      member_name: string;
      content: string;
      answer: string;
      created_at: string;
    }>();
  return result.results.map((r) => ({
    id: r.id,
    memberName: r.member_name,
    content: r.content,
    answer: r.answer,
    createdAt: r.created_at,
  }));
}

export type AdminReview = ProductReview & {
  productId: string;
  productName: string;
};
export async function listAdminReviews(): Promise<AdminReview[]> {
  const result = await getD1()
    .prepare(
      'SELECT reviews.id, reviews.product_id, products.name AS product_name, reviews.member_name, reviews.rating, reviews.content, reviews.admin_reply, reviews.created_at FROM reviews JOIN products ON products.id = reviews.product_id ORDER BY reviews.created_at DESC',
    )
    .all<{
      id: string;
      product_id: string;
      product_name: string;
      member_name: string;
      rating: number;
      content: string;
      admin_reply: string;
      created_at: string;
    }>();
  return result.results.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    memberName: r.member_name,
    rating: r.rating,
    content: r.content,
    adminReply: r.admin_reply,
    createdAt: r.created_at,
  }));
}
export type AdminInquiry = ProductInquiry & {
  productId: string;
  productName: string;
};
export async function listAdminInquiries(): Promise<AdminInquiry[]> {
  const result = await getD1()
    .prepare(
      'SELECT product_inquiries.id, product_inquiries.product_id, products.name AS product_name, product_inquiries.member_name, product_inquiries.content, product_inquiries.answer, product_inquiries.created_at FROM product_inquiries JOIN products ON products.id = product_inquiries.product_id ORDER BY product_inquiries.created_at DESC',
    )
    .all<{
      id: string;
      product_id: string;
      product_name: string;
      member_name: string;
      content: string;
      answer: string;
      created_at: string;
    }>();
  return result.results.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    memberName: r.member_name,
    content: r.content,
    answer: r.answer,
    createdAt: r.created_at,
  }));
}
