import { getD1 } from './index';
import {
  DEFAULT_SETTINGS,
  type OpsSettings,
  type ReorderRow,
  changePct,
  extractPrice,
  landedCost,
  marginPct,
  planReorder,
  sortPlan,
} from '@/lib/ops/calc';

const VALID_ORDER = "orders.status NOT IN ('취소', '반품')";
const USER_AGENT = 'Mozilla/5.0 (compatible; ChooseCPriceCheck/1.0)';

// ---------- 설정 ----------

export async function getOpsSettings(): Promise<OpsSettings> {
  const rows = await getD1().prepare('SELECT key, value FROM ops_settings').all<{ key: string; value: number }>();
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows.results) {
    if (row.key in settings) settings[row.key as keyof OpsSettings] = Number(row.value);
  }
  return settings;
}

export async function saveOpsSettings(values: Partial<OpsSettings>) {
  const statements = Object.entries(values)
    .filter(([key, value]) => key in DEFAULT_SETTINGS && Number.isFinite(value) && (value as number) >= 0)
    .map(([key, value]) =>
      getD1()
        .prepare('INSERT INTO ops_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
        .bind(key, value),
    );
  if (statements.length) await getD1().batch(statements);
}

// ---------- 도매처·도매가 ----------

export type Supplier = {
  id: string;
  name: string;
  country: string;
  currency: string;
  site_url: string;
  lead_days: number;
  shipping_per_unit: number;
  duty_rate: number;
  memo: string;
  item_count: number;
};

export async function listSuppliers() {
  const rows = await getD1()
    .prepare(
      `SELECT suppliers.*, COUNT(supplier_items.id) AS item_count FROM suppliers
       LEFT JOIN supplier_items ON supplier_items.supplier_id = suppliers.id
       GROUP BY suppliers.id ORDER BY suppliers.name`,
    )
    .all<Supplier>();
  return rows.results;
}

type SupplierItemRow = {
  id: string;
  supplier_id: string;
  product_id: string | null;
  title: string;
  url: string;
  price: number | null;
  min_order_qty: number;
  auto_fetch: number;
  last_checked_at: string | null;
  last_error: string;
  supplier_name: string;
  currency: string;
  lead_days: number;
  shipping_per_unit: number;
  duty_rate: number;
  product_name: string | null;
  sell_price: number | null;
};

export type SupplierItemView = SupplierItemRow & {
  costKrw: number | null;
  previousPrice: number | null;
  changePct: number | null;
  history: number[];
  marginPct: number | null;
  isCheapest: boolean;
};

/** 도매 상품별 원화 원가, 직전 대비 변동률, 판매가 대비 마진. 같은 상품 중 원가가 가장 싼 곳을 표시한다. */
export async function listSupplierItems(settings?: OpsSettings): Promise<SupplierItemView[]> {
  const opsSettings = settings ?? (await getOpsSettings());
  const [items, history] = await Promise.all([
    getD1()
      .prepare(
        `SELECT supplier_items.*, suppliers.name AS supplier_name, suppliers.currency, suppliers.lead_days,
                suppliers.shipping_per_unit, suppliers.duty_rate, products.name AS product_name, products.price AS sell_price
         FROM supplier_items
         JOIN suppliers ON suppliers.id = supplier_items.supplier_id
         LEFT JOIN products ON products.id = supplier_items.product_id
         ORDER BY products.name IS NULL, products.name, supplier_items.created_at`,
      )
      .all<SupplierItemRow>(),
    getD1()
      .prepare('SELECT supplier_item_id, price FROM supplier_price_history ORDER BY checked_at, rowid')
      .all<{ supplier_item_id: string; price: number }>(),
  ]);
  const prices = new Map<string, number[]>();
  for (const row of history.results) prices.set(row.supplier_item_id, [...(prices.get(row.supplier_item_id) ?? []), row.price]);

  const views = items.results.map((item) => {
    const list = prices.get(item.id) ?? [];
    const costKrw = landedCost(item.price, { currency: item.currency, shippingPerUnit: item.shipping_per_unit, dutyRate: item.duty_rate }, opsSettings);
    const previousPrice = list.length >= 2 ? list[list.length - 2] : null;
    return {
      ...item,
      costKrw,
      previousPrice,
      changePct: changePct(previousPrice, item.price),
      history: list.slice(-20),
      marginPct: marginPct(item.sell_price, costKrw),
      isCheapest: false,
    };
  });
  const cheapest = new Map<string, SupplierItemView>();
  for (const view of views) {
    if (!view.product_id || view.costKrw === null) continue;
    const best = cheapest.get(view.product_id);
    if (!best || view.costKrw < (best.costKrw ?? Infinity)) cheapest.set(view.product_id, view);
  }
  for (const view of cheapest.values()) view.isCheapest = true;
  return views;
}

export async function recordPrice(itemId: string, price: number, source: 'manual' | 'auto') {
  await getD1().batch([
    getD1()
      .prepare("UPDATE supplier_items SET price = ?, last_checked_at = CURRENT_TIMESTAMP, last_error = '' WHERE id = ?")
      .bind(price, itemId),
    getD1()
      .prepare('INSERT INTO supplier_price_history (id, supplier_item_id, price, source) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), itemId, price, source),
  ]);
}

/** 로그인 없이 가격이 보이는 도매 페이지에서 가격을 읽어 기록한다. */
export async function refreshItemPrice(item: { id: string; url: string; currency: string }): Promise<boolean> {
  try {
    const response = await fetch(item.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`도매 사이트 응답 ${response.status}`);
    const found = extractPrice(await response.text());
    if (!found) throw new Error('페이지에서 가격을 찾지 못했습니다. 로그인이 필요한 사이트는 직접 입력해 주세요.');
    if (found.currency && found.currency !== item.currency) {
      throw new Error(`페이지 통화(${found.currency})가 도매처 통화(${item.currency})와 다릅니다.`);
    }
    await recordPrice(item.id, found.price, 'auto');
    return true;
  } catch (error) {
    await getD1()
      .prepare('UPDATE supplier_items SET last_checked_at = CURRENT_TIMESTAMP, last_error = ? WHERE id = ?')
      .bind(String(error instanceof Error ? error.message : error).slice(0, 300), item.id)
      .run();
    return false;
  }
}

export async function refreshAllPrices() {
  const items = await getD1()
    .prepare(
      `SELECT supplier_items.id, supplier_items.url, suppliers.currency FROM supplier_items
       JOIN suppliers ON suppliers.id = supplier_items.supplier_id
       WHERE supplier_items.auto_fetch = 1 AND supplier_items.url != ''`,
    )
    .all<{ id: string; url: string; currency: string }>();
  let ok = 0;
  for (const item of items.results) if (await refreshItemPrice(item)) ok += 1;
  return { ok, failed: items.results.length - ok };
}

// ---------- 재고·발주 ----------

export type PlanRow = Omit<ReorderRow, 'source'> & { source: SupplierItemView | null };

export async function buildReorderPlan(): Promise<PlanRow[]> {
  const settings = await getOpsSettings();
  const [products, sold, incoming, items] = await Promise.all([
    getD1().prepare('SELECT id, name, price, stock FROM products WHERE active = 1').all<{ id: string; name: string; price: number; stock: number | null }>(),
    getD1()
      .prepare(
        `SELECT order_items.product_id,
                SUM(CASE WHEN orders.created_at >= datetime('now', '-7 days') THEN order_items.quantity ELSE 0 END) AS units7,
                SUM(order_items.quantity) AS units30
         FROM order_items JOIN orders ON orders.id = order_items.order_id
         WHERE orders.created_at >= datetime('now', '-30 days') AND ${VALID_ORDER}
         GROUP BY order_items.product_id`,
      )
      .all<{ product_id: string; units7: number; units30: number }>(),
    getD1()
      .prepare("SELECT product_id, SUM(quantity) AS qty FROM purchase_orders WHERE status = '발주' GROUP BY product_id")
      .all<{ product_id: string; qty: number }>(),
    listSupplierItems(settings),
  ]);
  const soldMap = new Map(sold.results.map((row) => [row.product_id, row]));
  const incomingMap = new Map(incoming.results.map((row) => [row.product_id, Number(row.qty)]));
  const bestSource = new Map(items.filter((item) => item.isCheapest).map((item) => [item.product_id as string, item]));

  const rows = products.results.map((product) => {
    const source = bestSource.get(product.id) ?? null;
    const row = planReorder(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        units7: Number(soldMap.get(product.id)?.units7 ?? 0),
        units30: Number(soldMap.get(product.id)?.units30 ?? 0),
        onOrder: incomingMap.get(product.id) ?? 0,
        source: source ? { leadDays: source.lead_days, minOrderQty: source.min_order_qty, costKrw: source.costKrw } : null,
      },
      settings,
    );
    return row;
  });
  return sortPlan(rows).map((row) => ({ ...row, source: bestSource.get(row.productId) ?? null }));
}

export type PurchaseOrder = {
  id: string;
  product_id: string;
  product_name: string | null;
  supplier_name: string | null;
  quantity: number;
  unit_cost_krw: number;
  status: string;
  created_at: string;
  received_at: string | null;
};

export async function listPurchaseOrders() {
  const rows = await getD1()
    .prepare(
      `SELECT purchase_orders.*, products.name AS product_name, suppliers.name AS supplier_name
       FROM purchase_orders
       LEFT JOIN products ON products.id = purchase_orders.product_id
       LEFT JOIN supplier_items ON supplier_items.id = purchase_orders.supplier_item_id
       LEFT JOIN suppliers ON suppliers.id = supplier_items.supplier_id
       ORDER BY purchase_orders.status = '입고완료', purchase_orders.created_at DESC LIMIT 50`,
    )
    .all<PurchaseOrder>();
  return rows.results;
}

// ---------- 매출·방문 분석 ----------

type Totals = { revenue: number; orders: number; units: number; visitors: number; pageviews: number };

async function periodTotals(from: string, to: string): Promise<Totals> {
  const [sales, units, traffic] = await Promise.all([
    getD1()
      .prepare(`SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders FROM orders WHERE created_at >= datetime('now', ?) AND created_at < datetime('now', ?) AND ${VALID_ORDER}`)
      .bind(from, to)
      .first<{ revenue: number; orders: number }>(),
    getD1()
      .prepare(`SELECT COALESCE(SUM(order_items.quantity), 0) AS units FROM order_items JOIN orders ON orders.id = order_items.order_id WHERE orders.created_at >= datetime('now', ?) AND orders.created_at < datetime('now', ?) AND ${VALID_ORDER}`)
      .bind(from, to)
      .first<{ units: number }>(),
    getD1()
      .prepare("SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors FROM site_events WHERE type = 'pageview' AND ts >= datetime('now', ?) AND ts < datetime('now', ?)")
      .bind(from, to)
      .first<{ pageviews: number; visitors: number }>(),
  ]);
  return {
    revenue: Number(sales?.revenue ?? 0),
    orders: Number(sales?.orders ?? 0),
    units: Number(units?.units ?? 0),
    visitors: Number(traffic?.visitors ?? 0),
    pageviews: Number(traffic?.pageviews ?? 0),
  };
}

export async function getInsights(days: number) {
  const span = `-${days} days`;
  const [current, previous, daily, dailyVisitors, top, viewers, sources, devices, pages, funnel] = await Promise.all([
    periodTotals(span, '+0 seconds'),
    periodTotals(`-${days * 2} days`, span),
    getD1()
      .prepare(`SELECT date(created_at, '+9 hours') AS day, SUM(total) AS revenue, COUNT(*) AS orders FROM orders WHERE created_at >= datetime('now', ?) AND ${VALID_ORDER} GROUP BY day`)
      .bind(span)
      .all<{ day: string; revenue: number; orders: number }>(),
    getD1()
      .prepare("SELECT date(ts, '+9 hours') AS day, COUNT(DISTINCT visitor_id) AS visitors FROM site_events WHERE type = 'pageview' AND ts >= datetime('now', ?) GROUP BY day")
      .bind(span)
      .all<{ day: string; visitors: number }>(),
    getD1()
      .prepare(
        `SELECT order_items.product_id, COALESCE(products.name, MAX(order_items.product_name)) AS name, products.stock,
                SUM(order_items.line_total) AS revenue, SUM(order_items.quantity) AS units, COUNT(DISTINCT orders.id) AS orders
         FROM order_items JOIN orders ON orders.id = order_items.order_id
         LEFT JOIN products ON products.id = order_items.product_id
         WHERE orders.created_at >= datetime('now', ?) AND ${VALID_ORDER}
         GROUP BY order_items.product_id ORDER BY revenue DESC LIMIT 10`,
      )
      .bind(span)
      .all<{ product_id: string; name: string; stock: number | null; revenue: number; units: number; orders: number }>(),
    getD1()
      .prepare("SELECT product_id, COUNT(DISTINCT visitor_id) AS viewers FROM site_events WHERE type = 'pageview' AND product_id IS NOT NULL AND ts >= datetime('now', ?) GROUP BY product_id")
      .bind(span)
      .all<{ product_id: string; viewers: number }>(),
    getD1()
      .prepare(
        `SELECT CASE WHEN utm_source != '' THEN utm_source WHEN referrer != '' THEN referrer ELSE '직접 방문' END AS source,
                COUNT(DISTINCT visitor_id) AS visitors
         FROM site_events WHERE type = 'pageview' AND ts >= datetime('now', ?) GROUP BY source ORDER BY visitors DESC LIMIT 10`,
      )
      .bind(span)
      .all<{ source: string; visitors: number }>(),
    getD1()
      .prepare("SELECT device, COUNT(DISTINCT visitor_id) AS visitors FROM site_events WHERE type = 'pageview' AND ts >= datetime('now', ?) GROUP BY device ORDER BY visitors DESC")
      .bind(span)
      .all<{ device: string; visitors: number }>(),
    getD1()
      .prepare("SELECT path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors FROM site_events WHERE type = 'pageview' AND ts >= datetime('now', ?) GROUP BY path ORDER BY pageviews DESC LIMIT 10")
      .bind(span)
      .all<{ path: string; pageviews: number; visitors: number }>(),
    getD1()
      .prepare(
        `SELECT CASE WHEN type = 'pageview' AND path = '/checkout' THEN 'checkout' ELSE type END AS type, COUNT(DISTINCT visitor_id) AS visitors
         FROM site_events WHERE ts >= datetime('now', ?) GROUP BY 1
         UNION ALL
         SELECT 'visit', COUNT(DISTINCT visitor_id) FROM site_events WHERE type = 'pageview' AND ts >= datetime('now', ?)`,
      )
      .bind(span, span)
      .all<{ type: string; visitors: number }>(),
  ]);

  const revenueByDay = new Map(daily.results.map((row) => [row.day, row]));
  const visitorsByDay = new Map(dailyVisitors.results.map((row) => [row.day, row.visitors]));
  const today = new Date(Date.now() + 9 * 3600 * 1000);
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * 86400000).toISOString().slice(0, 10);
    return {
      day: date.slice(5),
      revenue: Number(revenueByDay.get(date)?.revenue ?? 0),
      orders: Number(revenueByDay.get(date)?.orders ?? 0),
      visitors: Number(visitorsByDay.get(date) ?? 0),
    };
  });
  const viewerMap = new Map(viewers.results.map((row) => [row.product_id, Number(row.viewers)]));
  const delta = (key: keyof Totals) => changePct(previous[key], current[key]);

  return {
    current,
    aov: current.orders ? current.revenue / current.orders : 0,
    conversion: current.visitors ? (current.orders / current.visitors) * 100 : null,
    deltas: { revenue: delta('revenue'), orders: delta('orders'), units: delta('units'), visitors: delta('visitors') },
    series,
    top: top.results.map((row) => {
      const productViewers = viewerMap.get(row.product_id) ?? 0;
      return { ...row, viewers: productViewers, conversion: productViewers ? (row.orders / productViewers) * 100 : null };
    }),
    sources: sources.results,
    devices: devices.results,
    pages: pages.results,
    funnel: Object.fromEntries(funnel.results.map((row) => [row.type, Number(row.visitors)])) as Record<string, number>,
  };
}

export async function recordEvent(event: {
  type: string;
  path: string;
  productId: string | null;
  referrer: string;
  utmSource: string;
  device: string;
  visitorId: string;
  sessionId: string;
}) {
  await getD1()
    .prepare(
      'INSERT INTO site_events (type, path, product_id, referrer, utm_source, device, visitor_id, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(event.type, event.path, event.productId, event.referrer, event.utmSource, event.device, event.visitorId, event.sessionId)
    .run();
}
