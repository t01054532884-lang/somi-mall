/* oxlint-disable next/no-html-link-for-pages */
import { getD1 } from '@/db';
import { getOpsSettings, listSupplierItems, listSuppliers } from '@/db/ops';
import { CURRENCIES } from '@/lib/ops/calc';
import ConfirmButton from '../confirm-button';
import { MigrationNeeded, OpsShell, PriceChange, Spark, num, requireAdminPage, won } from '../ops-ui';

export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<{ status?: string }> };

const COUNTRIES = [
  ['KR', '한국'],
  ['CN', '중국'],
  ['JP', '일본'],
  ['US', '미국'],
];

export default async function Wholesale({ searchParams }: Props) {
  await requireAdminPage();
  const query = await searchParams;
  let loaded;
  try {
    const opsSettings = await getOpsSettings();
    loaded = await Promise.all([
      opsSettings,
      listSuppliers(),
      listSupplierItems(opsSettings),
      getD1().prepare('SELECT id, name FROM products WHERE active = 1 ORDER BY name').all<{ id: string; name: string }>(),
    ]);
  } catch (error) {
    console.error('Wholesale load failed', error);
    return <MigrationNeeded active="/admin/wholesale" title="도매가 추적" />;
  }
  const [settings, suppliers, items, products] = loaded;
  const priceDigits = (currency: string) => (currency === 'CNY' || currency === 'USD' ? 2 : 0);

  return (
    <OpsShell
      active="/admin/wholesale"
      title="도매가 추적"
      description="중국·일본·한국·미국 도매처의 가격을 기록하고 원화 원가(환율 + 관부가세 + 개당 배송비)로 바꿔 비교합니다. 같은 상품 중 원가가 가장 싼 도매처를 표시하고 재고·발주 계산에 씁니다."
      status={query?.status}
      actions={
        <form action="/api/admin/ops/prices" method="post">
          <button>자동 확인 상품 지금 가격 확인</button>
        </form>
      }
    >
      <section className="admin-card">
        <h2>도매 상품 가격</h2>
        <p className="note">
          적용 환율: CNY {num(settings.fx_CNY, 1)}원 · JPY {num(settings.fx_JPY, 2)}원 · USD {num(settings.fx_USD)}원 (아래 환율에서 변경).
          자동 확인을 켠 상품은 6시간마다 가격을 다시 확인합니다.
        </p>
        {items.length ? (
          <div className="ops-table">
            <table>
              <thead>
                <tr>
                  <th>쇼핑몰 상품</th><th>도매 상품</th><th>도매처</th><th>도매가</th><th>직전 대비</th><th>추이</th>
                  <th>원화 원가</th><th>판매가</th><th>마진</th><th>가격 입력</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={item.isCheapest ? 'best' : ''}>
                    <td className="wrap">
                      {item.product_name ? (
                        <>
                          {item.product_name}
                          {item.isCheapest ? <span className="ops-pill ok">최저 원가</span> : null}
                        </>
                      ) : (
                        <form action={`/api/admin/ops/items/${item.id}`} method="post" className="ops-inline">
                          <input type="hidden" name="action" value="link" />
                          <select name="product_id" aria-label="연결할 쇼핑몰 상품" defaultValue="">
                            <option value="">연결 안 됨</option>
                            {products.results.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button>연결</button>
                        </form>
                      )}
                    </td>
                    <td className="wrap">
                      {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}
                      <small className="ops-muted block">
                        최소 {item.min_order_qty}개{item.auto_fetch ? ' · 자동 확인' : ''}
                        {item.last_checked_at ? ` · 확인 ${item.last_checked_at.slice(0, 10)}` : ''}
                      </small>
                      {item.last_error ? <small className="ops-error block">{item.last_error}</small> : null}
                    </td>
                    <td>{item.supplier_name}</td>
                    <td>{item.price === null ? '-' : `${num(item.price, priceDigits(item.currency))} ${item.currency}`}</td>
                    <td><PriceChange value={item.changePct} /></td>
                    <td><Spark values={item.history} /></td>
                    <td><b>{won(item.costKrw)}</b></td>
                    <td>{won(item.sell_price)}</td>
                    <td>{item.marginPct === null ? '-' : `${num(item.marginPct, 1)}%`}</td>
                    <td>
                      <form action={`/api/admin/ops/items/${item.id}`} method="post" className="ops-inline">
                        <input type="hidden" name="action" value="price" />
                        <input className="price" type="number" name="price" step="0.01" min="0.01" placeholder="새 도매가" required aria-label={`${item.title} 새 도매가`} />
                        <button>기록</button>
                      </form>
                      {item.url ? (
                        <form action={`/api/admin/ops/items/${item.id}`} method="post">
                          <input type="hidden" name="action" value="fetch" />
                          <button className="ops-link">사이트에서 확인</button>
                        </form>
                      ) : null}
                    </td>
                    <td>
                      <form action={`/api/admin/ops/items/${item.id}`} method="post">
                        <input type="hidden" name="action" value="delete" />
                        <ConfirmButton message="이 도매 상품과 가격 기록을 삭제할까요?">삭제</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">등록된 도매 상품이 없습니다. 아래에서 도매처와 상품을 추가해 주세요.</p>
        )}
      </section>

      <div className="ops-two">
        <section className="admin-card">
          <h2>도매 상품 추가</h2>
          {suppliers.length ? (
            <form action="/api/admin/ops/items" method="post">
              <div className="ops-form">
                <label className="field">도매처
                  <select name="supplier_id" required>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>)}
                  </select>
                </label>
                <label className="field">연결할 쇼핑몰 상품
                  <select name="product_id" defaultValue="">
                    <option value="">나중에 연결</option>
                    {products.results.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="field wide">도매 상품명<input name="title" required placeholder="예: 가을 벨티드 트렌치 베이지 FREE" /></label>
                <label className="field wide">도매 상품 주소 (선택)<input name="url" type="url" placeholder="https://" /></label>
                <label className="field">현재 도매가 (도매처 통화)<input name="price" type="number" step="0.01" min="0" /></label>
                <label className="field">최소 주문 수량<input name="min_order_qty" type="number" min={1} defaultValue={1} /></label>
                <label className="ops-check wide"><input type="checkbox" name="auto_fetch" value="1" /> 주소에서 가격 자동 확인 (로그인 없이 가격이 보이는 사이트만 가능)</label>
              </div>
              <button className="solid">추가</button>
            </form>
          ) : (
            <p className="note">먼저 오른쪽에서 도매처를 추가해 주세요.</p>
          )}
        </section>

        <section className="admin-card">
          <h2>도매처 추가</h2>
          <form action="/api/admin/ops/suppliers" method="post">
            <div className="ops-form">
              <label className="field wide">도매처 이름<input name="name" required placeholder="예: 동대문 OO상가 3층, 1688 OO공장" /></label>
              <label className="field">국가
                <select name="country">{COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
              </label>
              <label className="field">통화
                <select name="currency">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
              <label className="field">입고까지 걸리는 날<input name="lead_days" type="number" min={0} defaultValue={7} /></label>
              <label className="field">개당 배송·대행비 (원)<input name="shipping_per_unit" type="number" min={0} defaultValue={0} /></label>
              <label className="field">관부가세 (%)<input name="duty_rate" type="number" min={0} step="0.1" defaultValue={0} /></label>
              <label className="field">사이트 주소<input name="site_url" type="url" placeholder="https://" /></label>
              <label className="field wide">메모<input name="memo" placeholder="담당자, 결제 조건 등" /></label>
            </div>
            <button className="solid">도매처 추가</button>
          </form>
          <p className="note">해외 의류는 보통 관세 13% + 부가세 10%가 붙습니다. 통관 방식(개인 면세 한도, 사업자 수입)에 따라 달라지니 관세사나 배송대행지 견적으로 확인해 주세요.</p>
        </section>
      </div>

      {suppliers.length ? (
        <section className="admin-card">
          <h2>도매처 목록</h2>
          <div className="ops-table">
            <table>
              <thead><tr><th>이름</th><th>국가</th><th>통화</th><th>입고 소요</th><th>개당 배송비</th><th>관부가세</th><th>상품 수</th><th>메모</th><th /></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.site_url ? <a href={s.site_url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</td>
                    <td>{s.country}</td>
                    <td>{s.currency}</td>
                    <td>{s.lead_days}일</td>
                    <td>{won(s.shipping_per_unit)}</td>
                    <td>{num(s.duty_rate, 1)}%</td>
                    <td>{s.item_count}</td>
                    <td className="wrap">{s.memo}</td>
                    <td>
                      <form action={`/api/admin/ops/suppliers/${s.id}`} method="post">
                        <ConfirmButton message="도매처와 등록된 도매 상품을 모두 삭제할까요?">삭제</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="admin-card">
        <h2>환율 (1단위당 원)</h2>
        <form action="/api/admin/ops/settings" method="post">
          <input type="hidden" name="return" value="/admin/wholesale" />
          <div className="admin-grid">
            <label className="field">중국 위안 (CNY)<input name="fx_CNY" type="number" step="0.01" min={0} defaultValue={settings.fx_CNY} /></label>
            <label className="field">일본 엔 (JPY)<input name="fx_JPY" type="number" step="0.001" min={0} defaultValue={settings.fx_JPY} /></label>
            <label className="field">미국 달러 (USD)<input name="fx_USD" type="number" step="0.01" min={0} defaultValue={settings.fx_USD} /></label>
          </div>
          <p className="note">기본값은 예시입니다. 실제 환율이나 배송대행지 결제 환율로 바꿔 주세요.</p>
          <button className="solid">저장</button>
        </form>
      </section>
    </OpsShell>
  );
}
