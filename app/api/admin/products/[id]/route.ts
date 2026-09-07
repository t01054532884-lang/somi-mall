import { parseProductInput } from '@/app/admin-product-input';
import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminRequest(request))) {
    return new Response('관리자만 상품을 변경할 수 있습니다.', { status: 403 });
  }
  const { id } = await context.params;
  const formData = await request.formData();
  try {
    if (formData.get('_action') === 'delete') {
      await getD1().prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      return adminRedirect(request, 'deleted');
    }
    const product = parseProductInput(formData);
    await getD1()
      .prepare(
        `UPDATE products SET
          name = ?, brand = ?, category = ?, price = ?, original_price = ?,
          image_url = ?, colors = ?, badge = ?, today_dispatch = ?, active = ?,
          sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      )
      .bind(
        product.name, product.brand, product.category, product.price,
        product.originalPrice, product.imageUrl, JSON.stringify(product.colors),
        product.badge, product.todayDispatch ? 1 : 0, product.active ? 1 : 0,
        product.sortOrder, id,
      )
      .run();
    return adminRedirect(request, 'updated');
  } catch (error) {
    console.error('Product update failed', error);
    return adminRedirect(request, 'error');
  }
}

function adminRedirect(request: Request, status: string) {
  const url = new URL('/admin', request.url);
  url.searchParams.set('status', status);
  return Response.redirect(url, 303);
}
