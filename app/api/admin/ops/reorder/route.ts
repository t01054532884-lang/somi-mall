import { requireAdminRequest } from '@/app/admin-auth';
import { buildReorderPlan } from '@/db/ops';

const cell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

/** 발주 계획 CSV (엑셀·구글 시트용). */
export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) return new Response('관리자 권한이 필요합니다.', { status: 403 });
  const plan = await buildReorderPlan();
  const header = ['상태', '상품ID', '상품명', '현재 재고', '입고 예정', '7일 판매', '30일 판매', '하루 판매량', '재고 소진까지(일)', '발주 추천 수량', '추천 도매처', '도매 상품', '개당 원가(원)', '예상 발주액(원)'];
  const rows = plan.map((row) => [
    row.status,
    row.productId,
    row.name,
    row.stock ?? '',
    row.onOrder,
    row.units7,
    row.units30,
    row.velocity.toFixed(2),
    row.daysLeft === null ? '' : row.daysLeft.toFixed(1),
    row.quantity,
    row.source?.supplier_name ?? '',
    row.source?.title ?? '',
    row.source?.costKrw ?? '',
    row.orderCost ?? '',
  ]);
  const csv = '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="choose-c-reorder-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
