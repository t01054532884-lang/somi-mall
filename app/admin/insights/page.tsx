/* oxlint-disable next/no-html-link-for-pages */
import { getInsights } from '@/db/ops';
import { Delta, Kpi, MigrationNeeded, OpsShell, num, requireAdminPage, won } from '../ops-ui';

export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<{ days?: string; status?: string }> };

function DailyChart({ series }: { series: { day: string; revenue: number; visitors: number }[] }) {
  const width = 960;
  const height = 220;
  const pad = 28;
  const maxRevenue = Math.max(1, ...series.map((d) => d.revenue));
  const maxVisitors = Math.max(1, ...series.map((d) => d.visitors));
  const step = (width - pad * 2) / series.length;
  const points = series
    .map((d, i) => `${pad + step * i + step / 2},${height - pad - ((height - pad * 2) * d.visitors) / maxVisitors}`)
    .join(' ');
  return (
    <svg className="ops-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="일별 매출과 방문자 추이">
      {series.map((d, i) => {
        const barHeight = ((height - pad * 2) * d.revenue) / maxRevenue;
        return (
          <g key={d.day}>
            <rect x={pad + step * i + step * 0.15} y={height - pad - barHeight} width={step * 0.7} height={barHeight} className="bar">
              <title>{`${d.day} 매출 ${won(d.revenue)} · 방문자 ${d.visitors}명`}</title>
            </rect>
            {i % Math.ceil(series.length / 10) === 0 ? (
              <text x={pad + step * i + step / 2} y={height - 8} textAnchor="middle">
                {d.day}
              </text>
            ) : null}
          </g>
        );
      })}
      <polyline points={points} className="line" />
      <text x={pad} y={14}>최고 매출 {won(maxRevenue)} · 최고 방문 {maxVisitors}명</text>
    </svg>
  );
}

export default async function Insights({ searchParams }: Props) {
  await requireAdminPage();
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query?.days)) ? Number(query?.days) : 30;
  let data: Awaited<ReturnType<typeof getInsights>>;
  try {
    data = await getInsights(days);
  } catch (error) {
    console.error('Insights load failed', error);
    return <MigrationNeeded active="/admin/insights" title="매출·방문 분석" />;
  }
  const { current, funnel } = data;
  const maxSource = Math.max(1, ...data.sources.map((s) => s.visitors));

  return (
    <OpsShell
      active="/admin/insights"
      title="매출·방문 분석"
      description="취소·반품 주문은 제외합니다. 방문은 브라우저별 임의 ID로 세며 관리자 화면 방문은 포함하지 않습니다."
      status={query?.status}
      actions={
        <nav className="admin-tabs">
          {[7, 30, 90].map((d) => (
            <a key={d} href={`/admin/insights?days=${d}`} className={d === days ? 'selected' : ''}>
              {d}일
            </a>
          ))}
        </nav>
      }
    >
      <div className="ops-kpis">
        <Kpi label="매출" value={won(current.revenue)}><Delta value={data.deltas.revenue} /></Kpi>
        <Kpi label="주문 수" value={`${num(current.orders)}건`}><Delta value={data.deltas.orders} /></Kpi>
        <Kpi label="판매 수량" value={`${num(current.units)}개`}><Delta value={data.deltas.units} /></Kpi>
        <Kpi label="객단가" value={won(data.aov)} />
        <Kpi label="방문자" value={`${num(current.visitors)}명`}><Delta value={data.deltas.visitors} /></Kpi>
        <Kpi label="구매 전환율" value={data.conversion === null ? '-' : `${num(data.conversion, 2)}%`}>
          <small className="ops-muted">주문 수 ÷ 방문자</small>
        </Kpi>
      </div>

      <section className="admin-card">
        <h2>일별 매출과 방문자</h2>
        <DailyChart series={data.series} />
      </section>

      <section className="admin-card">
        <h2>잘 팔리는 상품</h2>
        {data.top.length ? (
          <div className="ops-table">
            <table>
              <thead>
                <tr><th>상품</th><th>매출</th><th>판매 수량</th><th>주문</th><th>상품 조회 방문자</th><th>조회 → 구매</th><th>남은 재고</th></tr>
              </thead>
              <tbody>
                {data.top.map((p) => (
                  <tr key={p.product_id}>
                    <td className="wrap">{p.name}</td>
                    <td>{won(p.revenue)}</td>
                    <td>{num(p.units)}</td>
                    <td>{num(p.orders)}</td>
                    <td>{num(p.viewers)}</td>
                    <td>{p.conversion === null ? '-' : `${num(p.conversion, 1)}%`}</td>
                    <td>{p.stock ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">이 기간에 판매가 없습니다.</p>
        )}
      </section>

      <div className="ops-two">
        <section className="admin-card">
          <h2>유입 경로</h2>
          {data.sources.length ? (
            <table className="ops-bars">
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td className="bar-cell"><i style={{ width: `${(100 * s.visitors) / maxSource}%` }} /></td>
                    <td>{num(s.visitors)}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note">아직 방문 기록이 없습니다.</p>
          )}
        </section>
        <section className="admin-card">
          <h2>구매 단계와 기기</h2>
          <table className="ops-bars">
            <tbody>
              <tr><td>방문</td><td>{num(funnel.visit ?? 0)}명</td></tr>
              <tr><td>장바구니 담기</td><td>{num(funnel.add_to_cart ?? 0)}명</td></tr>
              <tr><td>주문서 진입</td><td>{num(funnel.checkout ?? 0)}명</td></tr>
              <tr><td>주문 완료</td><td>{num(funnel.purchase ?? 0)}명</td></tr>
              {data.devices.map((d) => (
                <tr key={d.device} className="ops-muted"><td>{d.device === 'mobile' ? '모바일' : 'PC'}</td><td>{num(d.visitors)}명</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="admin-card">
        <h2>많이 본 페이지</h2>
        {data.pages.length ? (
          <div className="ops-table">
            <table>
              <thead><tr><th>페이지</th><th>조회수</th><th>방문자</th></tr></thead>
              <tbody>
                {data.pages.map((p) => (
                  <tr key={p.path}><td className="wrap"><code>{p.path}</code></td><td>{num(p.pageviews)}</td><td>{num(p.visitors)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">아직 방문 기록이 없습니다.</p>
        )}
      </section>
    </OpsShell>
  );
}
