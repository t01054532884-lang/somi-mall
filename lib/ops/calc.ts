// 운영 도구(재고 발주, 도매가 추적)의 계산. DB와 무관한 순수 함수라 node --test로 검증한다.

export const CURRENCIES = ['KRW', 'CNY', 'JPY', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

// 환율은 예시 기본값이므로 관리자 화면에서 실제 값으로 바꿔 써야 한다.
export const DEFAULT_SETTINGS = {
  fx_KRW: 1,
  fx_CNY: 195,
  fx_JPY: 9.3,
  fx_USD: 1400,
  default_lead_days: 7,
  safety_days: 5,
  cover_days: 21,
};
export type OpsSettings = typeof DEFAULT_SETTINGS;

export type ReorderStatus = '품절' | '발주 필요' | '주의' | '재고 미확인' | '정상' | '판매 없음';
const URGENCY: Record<ReorderStatus, number> = {
  품절: 0,
  '발주 필요': 1,
  주의: 2,
  '재고 미확인': 3,
  정상: 4,
  '판매 없음': 5,
};

export type SupplierCost = { currency: string; shippingPerUnit: number; dutyRate: number };

/** 도매가를 원화로 바꾸고 관부가세와 개당 배송비를 더한 실제 매입 원가. */
export function landedCost(price: number | null, supplier: SupplierCost, settings: OpsSettings): number | null {
  if (price === null) return null;
  const rate = settings[`fx_${supplier.currency}` as keyof OpsSettings] ?? 1;
  const goods = price * rate;
  return Math.round(goods + (goods * supplier.dutyRate) / 100 + supplier.shippingPerUnit);
}

/** 하루 판매량 = 최근 7일 평균 60% + 최근 30일 평균 40% (최근 추세를 더 반영). */
export function dailyVelocity(units7: number, units30: number): number {
  return (0.6 * units7) / 7 + (0.4 * units30) / 30;
}

export type ReorderInput = {
  productId: string;
  name: string;
  price: number;
  stock: number | null;
  units7: number;
  units30: number;
  onOrder: number;
  source: { leadDays: number; minOrderQty: number; costKrw: number | null } | null;
};

export type ReorderRow = ReorderInput & {
  velocity: number;
  leadDays: number;
  daysLeft: number | null;
  reorderPoint: number;
  quantity: number;
  status: ReorderStatus;
  orderCost: number | null;
};

/**
 * 발주 시점 = 하루 판매량 × (입고 소요일 + 안전 재고일).
 * 재고 + 입고 예정이 발주 시점 이하이면 (입고 소요일 + 안전 재고일 + 채울 판매일)치가 되도록 발주한다.
 * 최소 주문 수량보다 적으면 최소 수량으로 올린다.
 */
export function planReorder(input: ReorderInput, settings: OpsSettings): ReorderRow {
  const velocity = dailyVelocity(input.units7, input.units30);
  const leadDays = input.source?.leadDays ?? settings.default_lead_days;
  const reorderPoint = velocity * (leadDays + settings.safety_days);
  const { stock, onOrder } = input;
  const daysLeft = stock !== null && velocity > 0 ? stock / velocity : null;

  let quantity = 0;
  let status: ReorderStatus;
  if (stock === null) {
    status = '재고 미확인';
  } else if (velocity === 0) {
    status = stock <= 0 ? '품절' : '판매 없음';
  } else {
    if (stock + onOrder <= reorderPoint) {
      const target = velocity * (leadDays + settings.safety_days + settings.cover_days);
      quantity = Math.max(Math.ceil(target - stock - onOrder), input.source?.minOrderQty ?? 1);
    }
    if (stock <= 0) status = '품절';
    else if (quantity) status = '발주 필요';
    else if (daysLeft !== null && daysLeft <= (leadDays + settings.safety_days) * 1.5) status = '주의';
    else status = '정상';
  }

  const cost = input.source?.costKrw ?? null;
  return {
    ...input,
    velocity,
    leadDays,
    daysLeft,
    reorderPoint: Math.ceil(reorderPoint),
    quantity,
    status,
    orderCost: cost !== null ? quantity * cost : null,
  };
}

export function sortPlan(rows: ReorderRow[]): ReorderRow[] {
  return [...rows].sort(
    (a, b) => URGENCY[a.status] - URGENCY[b.status] || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9),
  );
}

export function changePct(previous: number | null, current: number | null): number | null {
  if (!previous || current === null) return null;
  return ((current - previous) / previous) * 100;
}

export function marginPct(sellPrice: number | null, cost: number | null): number | null {
  if (!sellPrice || cost === null) return null;
  return ((sellPrice - cost) / sellPrice) * 100;
}

export function parseNumber(text: unknown): number | null {
  const cleaned = String(text ?? '')
    .replaceAll(',', '')
    .replace(/[^\d.]/g, '');
  if (!cleaned || cleaned.split('.').length > 2) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type Found = { price: number; currency: string | null };

function findOffer(node: unknown): Found | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findOffer(child);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;
  for (const key of ['price', 'lowPrice']) {
    if (key in record) {
      const price = parseNumber(record[key]);
      if (price) return { price, currency: typeof record.priceCurrency === 'string' ? record.priceCurrency : null };
    }
  }
  for (const key of ['offers', '@graph', 'mainEntity']) {
    if (key in record) {
      const found = findOffer(record[key]);
      if (found) return found;
    }
  }
  return null;
}

/** 상품 페이지 HTML에서 가격을 찾는다. 구조화 데이터(JSON-LD)를 먼저 보고, 없으면 meta 태그를 본다. */
export function extractPrice(html: string): Found | null {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findOffer(JSON.parse(match[1].trim()));
      if (found) return found;
    } catch {
      // 잘못된 JSON-LD는 건너뛴다.
    }
  }

  let price: number | null = null;
  let currency: string | null = null;
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const [, name, value] of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) attrs[name.toLowerCase()] = value;
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();
    if (['product:price:amount', 'og:price:amount', 'price'].includes(key) && price === null) {
      price = parseNumber(attrs.content);
    } else if (['product:price:currency', 'og:price:currency', 'pricecurrency'].includes(key) && currency === null) {
      currency = attrs.content?.toUpperCase() || null;
    }
  }
  return price ? { price, currency } : null;
}

/** 유입 경로: 외부 사이트 도메인만 남기고, 쇼핑몰 안에서 이동한 경우는 비운다. */
export function referrerHost(referrer: string, pageHost: string): string {
  let host = '';
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
  return host === pageHost.toLowerCase().replace(/^www\./, '') ? '' : host.slice(0, 120);
}

export function cleanId(value: unknown, size: number): string {
  return String(value ?? '')
    .replace(/[^\w.-]/g, '')
    .slice(0, size);
}
