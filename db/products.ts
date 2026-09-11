import type { Product } from '@/app/catalog';
import { getD1 } from './index';

export type AdminProduct = Product & {
  active: boolean;
  sortOrder: number;
  stock: number;
};

type StoreProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number;
  image_url: string;
  image_position_x: number;
  image_position_y: number;
  colors: string;
  badge: string;
  today_dispatch: number;
  active: number;
  sale_status: '판매중' | '품절' | '판매 준비';
  style_tag: '에겐녀' | '테토녀' | '미분류';
  sort_order: number;
  review_count: number;
  average_rating: number | null;
  sales_count: number;
  stock: number;
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
      `SELECT products.id AS id, name, brand, category, price, original_price, image_url, image_position_x, image_position_y,
        colors, badge, today_dispatch, active, sale_status, style_tag, sort_order
       , stock,
       (SELECT COUNT(*) FROM reviews WHERE reviews.product_id = products.id) AS review_count,
       (SELECT AVG(rating) FROM reviews WHERE reviews.product_id = products.id) AS average_rating,
       (SELECT COALESCE(SUM(order_items.quantity),0) FROM order_items JOIN orders ON orders.id=order_items.order_id WHERE order_items.product_id=products.id AND orders.status NOT IN ('취소','반품')) AS sales_count
       FROM products
       WHERE active = 1
       ORDER BY sort_order DESC, products.created_at DESC`,
    )
    .all<StoreProductRow>();
  return result.results.map(toStoreProduct);
}

export async function getStoreProduct(id: string): Promise<Product | null> {
  const row = await getD1()
    .prepare(
      `SELECT products.id AS id, name, brand, category, price, original_price, image_url, image_position_x, image_position_y,
        description, detail_images, material, origin, manufacturer, size_chart,
        seller_name, seller_representative, seller_address, seller_business_number,
        seller_mail_order_number, seller_email, seller_phone,
        colors, badge, today_dispatch, active, sale_status, style_tag, sort_order,
        stock,
        (SELECT COUNT(*) FROM reviews WHERE reviews.product_id = products.id) AS review_count,
        (SELECT AVG(rating) FROM reviews WHERE reviews.product_id = products.id) AS average_rating,
        (SELECT COALESCE(SUM(order_items.quantity),0) FROM order_items JOIN orders ON orders.id=order_items.order_id WHERE order_items.product_id=products.id AND orders.status NOT IN ('취소','반품')) AS sales_count
       FROM products
       WHERE products.id = ? AND active = 1`,
    )
    .bind(id)
    .first<ProductRow>();
  return row ? toProduct(row) : null;
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const result = await getD1()
    .prepare(
      `SELECT products.id AS id, name, brand, category, price, original_price, image_url, image_position_x, image_position_y,
        description, detail_images, material, origin, manufacturer, size_chart,
        seller_name, seller_representative, seller_address, seller_business_number,
        seller_mail_order_number, seller_email, seller_phone,
        colors, badge, today_dispatch, active, sale_status, style_tag, sort_order
       , stock,
       (SELECT COUNT(*) FROM reviews WHERE reviews.product_id = products.id) AS review_count,
       (SELECT AVG(rating) FROM reviews WHERE reviews.product_id = products.id) AS average_rating,
       (SELECT COALESCE(SUM(order_items.quantity),0) FROM order_items JOIN orders ON orders.id=order_items.order_id WHERE order_items.product_id=products.id AND orders.status NOT IN ('취소','반품')) AS sales_count
       FROM products
       ORDER BY sort_order DESC, products.created_at DESC`,
    )
    .all<ProductRow>();
  return result.results.map((row) => ({
    ...toProduct(row),
    active: row.active === 1,
    sortOrder: row.sort_order,
  }));
}

function toStoreProduct(row: StoreProductRow): Product {
  const collections = parseCollections(row.category);
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category:
      collections.find((value) => !['BEST', 'NEW'].includes(value)) ??
      collections[0] ??
      row.category,
    collections,
    price: row.price,
    original: row.original_price,
    image: row.image_url,
    imagePositionX: Number(row.image_position_x ?? 50),
    imagePositionY: Number(row.image_position_y ?? 50),
    colors: parseColors(row.colors),
    badge: row.badge,
    todayDispatch: row.today_dispatch === 1,
    saleStatus: row.sale_status,
    styleTag: row.style_tag,
    reviewCount: Number(row.review_count ?? 0),
    averageRating: Number(row.average_rating ?? 0),
    salesCount: Number(row.sales_count ?? 0),
    stock: Number(row.stock ?? 0),
    sample: false,
  };
}

function parseCollections(value: string): string[] {
  const parsed = parseArray(value);
  return parsed.length ? parsed : value ? [value] : [];
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
  imageUrl: string;
  heightCm: number;
  weightKg: number;
  usualSize: string;
  adminReply: string;
  createdAt: string;
};
export async function listProductReviews(
  productId: string,
): Promise<ProductReview[]> {
  const result = await getD1()
    .prepare(
      'SELECT id, member_name, rating, content, image_url, height_cm, weight_kg, usual_size, admin_reply, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
    )
    .bind(productId)
    .all<{
      id: string;
      member_name: string;
      rating: number;
      content: string;
      image_url: string;
      height_cm: number;
      weight_kg: number;
      usual_size: string;
      admin_reply: string;
      created_at: string;
    }>();
  return result.results.map((r) => ({
    id: r.id,
    memberName: r.member_name,
    rating: r.rating,
    content: r.content,
    imageUrl: r.image_url,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    usualSize: r.usual_size,
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
      'SELECT reviews.id, reviews.product_id, products.name AS product_name, reviews.member_name, reviews.rating, reviews.content, reviews.image_url, reviews.height_cm, reviews.weight_kg, reviews.usual_size, reviews.admin_reply, reviews.created_at FROM reviews JOIN products ON products.id = reviews.product_id ORDER BY reviews.created_at DESC',
    )
    .all<{
      id: string;
      product_id: string;
      product_name: string;
      member_name: string;
      rating: number;
      content: string;
      image_url: string;
      height_cm: number;
      weight_kg: number;
      usual_size: string;
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
    imageUrl: r.image_url,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    usualSize: r.usual_size,
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
