import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';
import { backTo, formText } from '@/lib/ops/http';

/** receive: 입고 완료 + 상품 재고 증가, delete: 발주 기록 삭제. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const { id } = await params;
  const action = formText(await request.formData(), 'action');
  const order = await getD1()
    .prepare('SELECT product_id, quantity, status FROM purchase_orders WHERE id = ?')
    .bind(id)
    .first<{ product_id: string; quantity: number; status: string }>();
  if (!order) return backTo(request, '/admin/inventory', 'invalid');

  if (action === 'receive') {
    if (order.status !== '발주') return backTo(request, '/admin/inventory', 'invalid');
    // 한 트랜잭션 안에서 '발주' 상태일 때만 재고를 늘리고 상태를 바꾼다. 버튼을 두 번 눌러도 한 번만 반영된다.
    await getD1().batch([
      getD1()
        .prepare(
          "UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND EXISTS (SELECT 1 FROM purchase_orders WHERE id = ? AND status = '발주')",
        )
        .bind(order.quantity, order.product_id, id),
      getD1()
        .prepare("UPDATE purchase_orders SET status = '입고완료', received_at = CURRENT_TIMESTAMP WHERE id = ? AND status = '발주'")
        .bind(id),
    ]);
    return backTo(request, '/admin/inventory', 'po_received');
  }
  if (action === 'delete') {
    await getD1().prepare('DELETE FROM purchase_orders WHERE id = ?').bind(id).run();
    return backTo(request, '/admin/inventory', 'deleted');
  }
  return backTo(request, '/admin/inventory', 'invalid');
}
