import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';
import { recordPrice } from '@/db/ops';
import { backTo, formNumber, formText } from '@/lib/ops/http';

export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const form = await request.formData();
  const title = formText(form, 'title', 200);
  const supplierId = formText(form, 'supplier_id');
  const url = formText(form, 'url', 1000);
  if (!title || !supplierId || (url && !/^https?:\/\//.test(url))) return backTo(request, '/admin/wholesale', 'invalid');
  const supplier = await getD1().prepare('SELECT id FROM suppliers WHERE id = ?').bind(supplierId).first();
  if (!supplier) return backTo(request, '/admin/wholesale', 'invalid');

  const id = crypto.randomUUID();
  await getD1()
    .prepare('INSERT INTO supplier_items (id, supplier_id, product_id, title, url, min_order_qty, auto_fetch) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(
      id,
      supplierId,
      formText(form, 'product_id') || null,
      title,
      url,
      Math.max(Math.round(formNumber(form, 'min_order_qty') ?? 1), 1),
      form.get('auto_fetch') && url ? 1 : 0,
    )
    .run();
  const price = formNumber(form, 'price');
  if (price && price > 0) await recordPrice(id, price, 'manual');
  return backTo(request, '/admin/wholesale', 'saved');
}
