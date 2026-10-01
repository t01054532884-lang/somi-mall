import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';
import { listSupplierItems } from '@/db/ops';
import { backTo, formNumber, formText } from '@/lib/ops/http';

export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const form = await request.formData();
  const productId = formText(form, 'product_id');
  const quantity = Math.round(formNumber(form, 'quantity') ?? 0);
  if (!productId || quantity <= 0) return backTo(request, '/admin/inventory', 'invalid');
  const product = await getD1().prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
  if (!product) return backTo(request, '/admin/inventory', 'invalid');

  const itemId = formText(form, 'supplier_item_id') || null;
  const item = itemId ? (await listSupplierItems()).find((view) => view.id === itemId) : undefined;
  await getD1()
    .prepare('INSERT INTO purchase_orders (id, product_id, supplier_item_id, quantity, unit_cost_krw) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), productId, item ? item.id : null, quantity, item?.costKrw ?? 0)
    .run();
  return backTo(request, '/admin/inventory', 'po_created');
}
