import { parseProductInput } from '@/app/admin-product-input';
import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';

export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return new Response('관리자만 상품을 등록할 수 있습니다.', { status: 403 });
  }
  try {
    const product = parseProductInput(await request.formData());
    await getD1()
      .prepare(
        `INSERT INTO products (
          id, name, brand, category, price, original_price, image_url,
          description, detail_images, material, origin, manufacturer, size_chart,
          seller_name, seller_representative, seller_address, seller_business_number,
          seller_mail_order_number, seller_email, seller_phone, colors,
          badge, today_dispatch, active, sale_status, style_tag, sort_order, stock, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(
        crypto.randomUUID(), product.name, product.brand, product.category,
        product.price, product.originalPrice, product.imageUrl, product.description,
        JSON.stringify(product.detailImages), product.material, product.origin, product.manufacturer,
        JSON.stringify(product.sizeChart), product.sellerName, product.sellerRepresentative,
        product.sellerAddress, product.sellerBusinessNumber, product.sellerMailOrderNumber,
        product.sellerEmail, product.sellerPhone,
        JSON.stringify(product.colors), product.badge,
        product.todayDispatch ? 1 : 0, product.active ? 1 : 0, product.saleStatus, product.styleTag, product.sortOrder, product.stock,
      )
      .run();
    return adminRedirect(request, 'created');
  } catch (error) {
    console.error('Product create failed', error);
    return adminRedirect(request, 'error');
  }
}

function adminRedirect(request: Request, status: string) {
  const url = new URL('/admin', request.url);
  url.searchParams.set('status', status);
  return Response.redirect(url, 303);
}
