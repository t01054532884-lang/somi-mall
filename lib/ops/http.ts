export const OPS_PAGES = ['/admin/insights', '/admin/inventory', '/admin/wholesale'] as const;

export const OPS_MESSAGES: Record<string, string> = {
  saved: '저장했습니다.',
  deleted: '삭제했습니다.',
  invalid: '입력값을 확인해 주세요.',
  price_saved: '도매가를 기록했습니다.',
  price_fetched: '도매 사이트에서 가격을 가져왔습니다.',
  price_failed: '가격을 가져오지 못했습니다. 표의 오류 내용을 확인하거나 직접 입력해 주세요.',
  po_created: "발주를 기록했습니다. 입고되면 '입고 완료'를 눌러 주세요.",
  po_received: '입고 완료 처리하고 상품 재고를 늘렸습니다.',
  error: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 처리 후 운영 화면으로 돌아간다. 돌아갈 주소는 운영 화면 목록 안에서만 허용한다. */
export function backTo(request: Request, path: string, status: string) {
  const target = (OPS_PAGES as readonly string[]).includes(path) ? path : '/admin';
  const url = new URL(target, request.url);
  url.searchParams.set('status', status);
  return Response.redirect(url, 303);
}

export function formNumber(form: FormData, key: string): number | null {
  const text = String(form.get(key) ?? '')
    .replaceAll(',', '')
    .trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function formText(form: FormData, key: string, max = 300): string {
  return String(form.get(key) ?? '')
    .trim()
    .slice(0, max);
}
