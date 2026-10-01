/* oxlint-disable next/no-html-link-for-pages */
import { buildReorderPlan, getOpsSettings, listPurchaseOrders } from '@/db/ops';
import ConfirmButton from '../confirm-button';
import { Kpi, MigrationNeeded, OpsShell, StatusPill, num, requireAdminPage, won } from '../ops-ui';

export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<{ status?: string }> };

export default async function Inventory({ searchParams }: Props) {
  await requireAdminPage();
  const query = await searchParams;
  let loaded;
  try {
    loaded = await Promise.all([buildReorderPlan(), listPurchaseOrders(), getOpsSettings()]);
  } catch (error) {
    console.error('Inventory load failed', error);
    return <MigrationNeeded active="/admin/inventory" title="재고·발주" />;
  }
  const [plan, orders, settings] = loaded;
  const count = (status: string) => plan.filter((row) => row.status === status).length;
  const totalCost = plan.reduce((sum, row) => sum + (row.orderCost ?? 0), 0);

  return (
    <OpsShell
      active="/admin/inventory"
      title="재고·발주"
      description={`최근 판매 속도로 재고가 며칠 버티는지 계산하고, 입고 소요일 + 안전 재고 ${settings.safety_days}일 안에 떨어지는 상품은 ${settings.cover_days}일치를 더 채우도록 발주 수량을 추천합니다. 도매처는 원화 원가가 가장 싼 곳을 기준으로 합니다.`}
      status={query?.status}
      actions={<a className="solid" href="/api/admin/ops/reorder">엑셀·시트용 CSV 내려받기</a>}
    >
      <div className="ops-kpis">
        <Kpi label="품절" value={`${count('품절')}개`} />
        <Kpi label="발주 필요" value={`${count('발주 필요')}개`} />
        <Kpi label="주의" value={`${count('주의')}개`} />
        <Kpi label="추천대로 발주할 때 예상 금액" value={won(totalCost)} />
      </div>

      <section className="admin-card">
        <h2>발주 계획</h2>
        {plan.length ? (
          <div className="ops-table">
            <table>
              <thead>
                <tr>
                  <th>상태</th><th>상품</th><th>재고</th><th>입고 예정</th><th>7일 판매</th><th>30일 판매</th>
                  <th>하루 판매량</th><th>소진까지</th><th>추천 도매처</th><th>개당 원가</th><th>마진</th><th>발주 기록</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((row) => (
                  <tr key={row.productId}>
                    <td><StatusPill status={row.status} /></td>
                    <td className="wrap">{row.name}<small className="ops-muted block">판매가 {won(row.price)}</small></td>
                    <td>{row.stock ?? '미확인'}</td>
                    <td>{num(row.onOrder)}</td>
                    <td>{num(row.units7)}</td>
                    <td>{num(row.units30)}</td>
                    <td>{num(row.velocity, 2)}</td>
                    <td>{row.daysLeft === null ? '-' : `${num(row.daysLeft, 1)}일`}</td>
                    <td className="wrap">
                      {row.source ? (
                        <>
                          {row.source.supplier_name}
                          <small className="ops-muted block">
                            {row.source.title} · 입고 {row.leadDays}일{row.source.min_order_qty > 1 ? ` · 최소 ${row.source.min_order_qty}개` : ''}
                          </small>
                        </>
                      ) : (
                        <a href="/admin/wholesale">도매처 연결하기</a>
                      )}
                    </td>
                    <td>{won(row.source?.costKrw)}</td>
                    <td>{row.source?.marginPct == null ? '-' : `${num(row.source.marginPct, 1)}%`}</td>
                    <td>
                      <form action="/api/admin/ops/purchase-orders" method="post" className="ops-inline">
                        <input type="hidden" name="product_id" value={row.productId} />
                        <input type="hidden" name="supplier_item_id" value={row.source?.id ?? ''} />
                        <input className="qty" type="number" name="quantity" min={1} defaultValue={row.quantity || undefined} placeholder="수량" required aria-label={`${row.name} 발주 수량`} />
                        <button className={row.quantity ? 'solid' : ''}>기록</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">판매 중인 상품이 없습니다.</p>
        )}
      </section>

      <section className="admin-card">
        <h2>발주 내역</h2>
        <p className="note">
          &apos;입고 대기&apos; 수량은 입고 예정으로 계산되어 같은 상품을 두 번 주문하지 않게 막아 줍니다. &apos;입고 완료&apos;를 누르면 상품 재고가 그만큼 늘어납니다.
        </p>
        {orders.length ? (
          <div className="ops-table">
            <table>
              <thead><tr><th>발주일</th><th>상품</th><th>도매처</th><th>수량</th><th>개당 원가</th><th>합계</th><th>상태</th><th /></tr></thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id}>
                    <td>{po.created_at.slice(0, 10)}</td>
                    <td className="wrap">{po.product_name ?? po.product_id}</td>
                    <td>{po.supplier_name ?? '-'}</td>
                    <td>{num(po.quantity)}</td>
                    <td>{won(po.unit_cost_krw)}</td>
                    <td>{won(po.unit_cost_krw * po.quantity)}</td>
                    <td>
                      {po.status === '발주' ? <span className="ops-pill accent">입고 대기</span> : <span className="ops-pill gray">입고 완료 {po.received_at?.slice(0, 10)}</span>}
                    </td>
                    <td className="ops-actions">
                      {po.status === '발주' ? (
                        <form action={`/api/admin/ops/purchase-orders/${po.id}`} method="post">
                          <input type="hidden" name="action" value="receive" />
                          <button>입고 완료</button>
                        </form>
                      ) : null}
                      <form action={`/api/admin/ops/purchase-orders/${po.id}`} method="post">
                        <input type="hidden" name="action" value="delete" />
                        <ConfirmButton message="이 발주 기록을 삭제할까요?">삭제</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">아직 발주 기록이 없습니다.</p>
        )}
      </section>

      <section className="admin-card">
        <h2>발주 기준</h2>
        <form action="/api/admin/ops/settings" method="post">
          <input type="hidden" name="return" value="/admin/inventory" />
          <div className="admin-grid">
            <label className="field">기본 입고 소요일 (도매처 미연결 상품)<input name="default_lead_days" type="number" min={0} defaultValue={settings.default_lead_days} /></label>
            <label className="field">안전 재고일<input name="safety_days" type="number" min={0} defaultValue={settings.safety_days} /></label>
            <label className="field">한 번에 채울 판매일<input name="cover_days" type="number" min={1} defaultValue={settings.cover_days} /></label>
          </div>
          <p className="note">
            예: 하루 2개 팔리고 입고 10일, 안전 재고 5일, 채울 판매일 21일이면 재고가 30개(2 × 15일) 이하일 때 72개(2 × 36일)가 되도록 발주를 추천합니다.
            하루 판매량은 최근 7일 평균 60% + 최근 30일 평균 40%로 계산합니다.
          </p>
          <button className="solid">저장</button>
        </form>
      </section>
    </OpsShell>
  );
}
