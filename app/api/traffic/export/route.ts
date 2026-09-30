// 트래픽 대시보드가 상품·재고·주문을 가져가는 읽기 전용 주소. 고객 이름·연락처·주소·이메일은 내보내지 않는다.
import { env } from 'cloudflare:workers';
import { getD1 } from '@/db';

type ExportEnvironment = { TRAFFIC_EXPORT_TOKEN?: string };

export async function GET(request: Request) {
  const runtime = env as unknown as ExportEnvironment;
  const token = runtime.TRAFFIC_EXPORT_TOKEN ?? process.env.TRAFFIC_EXPORT_TOKEN;
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const products = await getD1()
    .prepare('SELECT id, name, brand, category, price, stock, active FROM products')
    .all<{ id: string; name: string; brand: string; category: string; price: number; stock: number; active: number }>();
  const orders = await getD1()
    .prepare('SELECT id, order_number, status, created_at FROM orders ORDER BY created_at')
    .all<{ id: string; order_number: string; status: string; created_at: string }>();
  const items = await getD1()
    .prepare('SELECT order_id, product_id, product_name, option_name, quantity, unit_price, line_total FROM order_items')
    .all<{ order_id: string; product_id: string; product_name: string; option_name: string; quantity: number; unit_price: number; line_total: number }>();

  const itemsByOrder = new Map<string, typeof items.results>();
  for (const item of items.results) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  }

  return Response.json(
    {
      products: products.results.map((p) => ({ ...p, active: Boolean(p.active) })),
      orders: orders.results.map((o) => ({
        orderNumber: o.order_number,
        status: o.status,
        createdAt: o.created_at,
        items: (itemsByOrder.get(o.id) ?? []).map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          optionName: i.option_name,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          lineTotal: i.line_total,
        })),
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
