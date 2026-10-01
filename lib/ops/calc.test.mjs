// 실행: pnpm test:ops (Node 22.18+ / 24의 TypeScript 타입 제거 기능으로 calc.ts를 바로 불러온다)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SETTINGS,
  changePct,
  extractPrice,
  landedCost,
  marginPct,
  planReorder,
  referrerHost,
  sortPlan,
} from './calc.ts';

const base = { productId: 'p1', name: '트렌치', price: 89000, onOrder: 0, source: null };

test('빠르게 팔리는 상품은 발주 수량을 추천한다', () => {
  const row = planReorder({ ...base, stock: 5, units7: 14, units30: 37 }, DEFAULT_SETTINGS);
  assert.ok(Math.abs(row.velocity - 1.69333) < 0.001);
  assert.equal(row.status, '발주 필요');
  // 입고 7일 + 안전 5일 + 채울 21일 = 33일치 - 재고 5
  assert.equal(row.quantity, 51);
});

test('입고 예정 수량이 충분하면 발주하지 않는다', () => {
  const row = planReorder({ ...base, stock: 2, units7: 7, units30: 7, onOrder: 100 }, DEFAULT_SETTINGS);
  assert.equal(row.quantity, 0);
});

test('도매처 입고 소요일과 최소 주문 수량을 쓴다', () => {
  const row = planReorder(
    { ...base, stock: 0, units7: 1, units30: 1, source: { leadDays: 14, minOrderQty: 10, costKrw: 17400 } },
    DEFAULT_SETTINGS,
  );
  assert.equal(row.status, '품절');
  assert.equal(row.leadDays, 14);
  assert.equal(row.quantity, 10);
  assert.equal(row.orderCost, 174000);
});

test('재고 정보가 없거나 판매가 없으면 발주하지 않는다', () => {
  assert.equal(planReorder({ ...base, stock: null, units7: 5, units30: 5 }, DEFAULT_SETTINGS).status, '재고 미확인');
  assert.equal(planReorder({ ...base, stock: 3, units7: 0, units30: 0 }, DEFAULT_SETTINGS).status, '판매 없음');
  assert.equal(planReorder({ ...base, stock: 0, units7: 0, units30: 0 }, DEFAULT_SETTINGS).status, '품절');
});

test('급한 순서로 정렬한다', () => {
  const rows = [
    planReorder({ ...base, productId: 'ok', stock: 500, units7: 7, units30: 30 }, DEFAULT_SETTINGS),
    planReorder({ ...base, productId: 'out', stock: 0, units7: 7, units30: 30 }, DEFAULT_SETTINGS),
    planReorder({ ...base, productId: 'need', stock: 3, units7: 7, units30: 30 }, DEFAULT_SETTINGS),
  ];
  assert.deepEqual(sortPlan(rows).map((r) => r.productId), ['out', 'need', 'ok']);
});

test('원화 원가 = 도매가 × 환율 + 관부가세 + 개당 배송비', () => {
  const settings = { ...DEFAULT_SETTINGS, fx_CNY: 200 };
  assert.equal(landedCost(70, { currency: 'CNY', shippingPerUnit: 2000, dutyRate: 10 }, settings), 17400);
  assert.equal(landedCost(null, { currency: 'KRW', shippingPerUnit: 0, dutyRate: 0 }, settings), null);
  assert.ok(Math.abs(marginPct(49000, 17400) - 64.49) < 0.01);
  assert.equal(changePct(100, 110), 10);
  assert.equal(changePct(null, 110), null);
});

test('상품 페이지에서 가격을 찾는다', () => {
  assert.deepEqual(
    extractPrice('<script type="application/ld+json">{"@type":"Product","offers":{"price":"128.50","priceCurrency":"CNY"}}</script>'),
    { price: 128.5, currency: 'CNY' },
  );
  assert.deepEqual(
    extractPrice('<meta content="32,000" property="product:price:amount"><meta property="product:price:currency" content="KRW">'),
    { price: 32000, currency: 'KRW' },
  );
  assert.equal(extractPrice('<p>로그인 후 가격 확인</p>'), null);
});

test('유입 경로는 외부 도메인만 남긴다', () => {
  assert.equal(referrerHost('https://www.instagram.com/p/1', 'choose-c.com'), 'instagram.com');
  assert.equal(referrerHost('https://www.choose-c.com/cart', 'choose-c.com'), '');
  assert.equal(referrerHost('', 'choose-c.com'), '');
});
