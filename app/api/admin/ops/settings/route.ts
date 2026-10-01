import { requireAdminRequest } from '@/app/admin-auth';
import { saveOpsSettings } from '@/db/ops';
import { DEFAULT_SETTINGS, type OpsSettings } from '@/lib/ops/calc';
import { backTo, formNumber, formText } from '@/lib/ops/http';

export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const form = await request.formData();
  const values: Partial<OpsSettings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof OpsSettings)[]) {
    const value = formNumber(form, key);
    if (value !== null && value >= 0) values[key] = value;
  }
  try {
    await saveOpsSettings(values);
  } catch (error) {
    console.error('Ops settings save failed', error);
    return backTo(request, formText(form, 'return'), 'error');
  }
  return backTo(request, formText(form, 'return'), 'saved');
}
