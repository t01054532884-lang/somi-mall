import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';
import { CURRENCIES } from '@/lib/ops/calc';
import { backTo, formNumber, formText } from '@/lib/ops/http';

export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const form = await request.formData();
  const name = formText(form, 'name', 100);
  const currency = formText(form, 'currency');
  const siteUrl = formText(form, 'site_url', 500);
  if (!name || !(CURRENCIES as readonly string[]).includes(currency) || (siteUrl && !/^https?:\/\//.test(siteUrl))) {
    return backTo(request, '/admin/wholesale', 'invalid');
  }
  await getD1()
    .prepare(
      `INSERT INTO suppliers (id, name, country, currency, site_url, lead_days, shipping_per_unit, duty_rate, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      name,
      formText(form, 'country', 2) || 'KR',
      currency,
      siteUrl,
      Math.max(Math.round(formNumber(form, 'lead_days') ?? 7), 0),
      Math.max(Math.round(formNumber(form, 'shipping_per_unit') ?? 0), 0),
      Math.max(formNumber(form, 'duty_rate') ?? 0, 0),
      formText(form, 'memo'),
    )
    .run();
  return backTo(request, '/admin/wholesale', 'saved');
}
