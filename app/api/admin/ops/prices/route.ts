import { requireAdminRequest } from '@/app/admin-auth';
import { refreshAllPrices } from '@/db/ops';
import { backTo } from '@/lib/ops/http';

/** 자동 확인을 켠 도매 상품의 가격을 지금 확인한다. 같은 작업이 6시간마다 자동으로도 실행된다. */
export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const { failed } = await refreshAllPrices();
  return backTo(request, '/admin/wholesale', failed ? 'price_failed' : 'price_fetched');
}
