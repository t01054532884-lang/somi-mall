import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';
import { recordPrice, refreshItemPrice } from '@/db/ops';
import { backTo, formNumber, formText } from '@/lib/ops/http';

/** 도매 상품 하나에 대한 작업: price(가격 직접 기록), fetch(사이트에서 확인), link(쇼핑몰 상품 연결), delete. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  const action = formText(form, 'action');
  const item = await getD1()
    .prepare(
      `SELECT supplier_items.id, supplier_items.url, suppliers.currency FROM supplier_items
       JOIN suppliers ON suppliers.id = supplier_items.supplier_id WHERE supplier_items.id = ?`,
    )
    .bind(id)
    .first<{ id: string; url: string; currency: string }>();
  if (!item) return backTo(request, '/admin/wholesale', 'invalid');

  if (action === 'price') {
    const price = formNumber(form, 'price');
    if (!price || price <= 0) return backTo(request, '/admin/wholesale', 'invalid');
    await recordPrice(id, price, 'manual');
    return backTo(request, '/admin/wholesale', 'price_saved');
  }
  if (action === 'fetch') {
    if (!item.url) return backTo(request, '/admin/wholesale', 'invalid');
    return backTo(request, '/admin/wholesale', (await refreshItemPrice(item)) ? 'price_fetched' : 'price_failed');
  }
  if (action === 'link') {
    await getD1().prepare('UPDATE supplier_items SET product_id = ? WHERE id = ?').bind(formText(form, 'product_id') || null, id).run();
    return backTo(request, '/admin/wholesale', 'saved');
  }
  if (action === 'delete') {
    await getD1().batch([
      getD1().prepare('DELETE FROM supplier_price_history WHERE supplier_item_id = ?').bind(id),
      getD1().prepare('UPDATE purchase_orders SET supplier_item_id = NULL WHERE supplier_item_id = ?').bind(id),
      getD1().prepare('DELETE FROM supplier_items WHERE id = ?').bind(id),
    ]);
    return backTo(request, '/admin/wholesale', 'deleted');
  }
  return backTo(request, '/admin/wholesale', 'invalid');
}
