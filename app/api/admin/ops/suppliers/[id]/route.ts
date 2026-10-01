import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';
import { backTo } from '@/lib/ops/http';

/** 도매처 삭제. 등록된 도매 상품과 가격 기록도 함께 지운다. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const { id } = await params;
  await getD1().batch([
    getD1()
      .prepare('DELETE FROM supplier_price_history WHERE supplier_item_id IN (SELECT id FROM supplier_items WHERE supplier_id = ?)')
      .bind(id),
    getD1().prepare('UPDATE purchase_orders SET supplier_item_id = NULL WHERE supplier_item_id IN (SELECT id FROM supplier_items WHERE supplier_id = ?)').bind(id),
    getD1().prepare('DELETE FROM supplier_items WHERE supplier_id = ?').bind(id),
    getD1().prepare('DELETE FROM suppliers WHERE id = ?').bind(id),
  ]);
  return backTo(request, '/admin/wholesale', 'deleted');
}
