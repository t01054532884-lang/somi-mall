/* oxlint-disable next/no-html-link-for-pages */
import { redirect } from 'next/navigation';
import { getAdminUser } from '../admin-auth';
import { OPS_MESSAGES } from '@/lib/ops/http';
import type { ReorderStatus } from '@/lib/ops/calc';

export const OPS_NAV = [
  { href: '/admin', label: '상품·주문 관리' },
  { href: '/admin/insights', label: '매출·방문 분석' },
  { href: '/admin/inventory', label: '재고·발주' },
  { href: '/admin/wholesale', label: '도매가 추적' },
];

/** 운영 화면은 관리자만 볼 수 있다. 로그인 전이면 관리자 로그인 화면으로 보낸다. */
export async function requireAdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin');
  return admin;
}

export function won(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function num(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined
    ? '-'
    : value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function OpsNav({ active }: { active: string }) {
  return (
    <nav className="ops-nav" aria-label="관리자 메뉴">
      {OPS_NAV.map((item) => (
        <a key={item.href} href={item.href} className={item.href === active ? 'selected' : ''}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function OpsShell({
  active,
  title,
  description,
  status,
  actions,
  children,
}: {
  active: string;
  title: string;
  description: string;
  status?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const message = status ? OPS_MESSAGES[status] : undefined;
  const isError = status === 'invalid' || status === 'error' || status === 'price_failed';
  return (
    <main className="admin-shell ops">
      <header className="admin-header">
        <div>
          <a className="logo" href="/">
            CHOOSE-C
            <i />
          </a>
          <p>운영자 전용 관리</p>
        </div>
      </header>
      <OpsNav active={active} />
      {message ? <p className={isError ? 'error' : 'success'}>{message}</p> : null}
      <div className="ops-head">
        <div>
          <h1>{title}</h1>
          <p className="note">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}

const PILL: Partial<Record<ReorderStatus, string>> = { 품절: 'bad', '발주 필요': 'bad', 주의: 'warn', 정상: 'ok' };

export function StatusPill({ status }: { status: ReorderStatus }) {
  return <span className={`ops-pill ${PILL[status] ?? 'gray'}`}>{status}</span>;
}

/** 지난 기간 대비 증감 (매출·방문은 오르면 좋음). */
export function Delta({ value }: { value: number | null }) {
  if (value === null) return <small className="ops-muted">이전 기간 데이터 없음</small>;
  return (
    <small className={value >= 0 ? 'ops-up' : 'ops-down'}>
      {value >= 0 ? '▲' : '▼'} {num(Math.abs(value), 1)}% 지난 기간 대비
    </small>
  );
}

/** 도매가 변동 (가격은 오르면 나쁨). */
export function PriceChange({ value }: { value: number | null }) {
  if (value === null) return <span className="ops-muted">-</span>;
  if (value === 0) return <span className="ops-muted">0%</span>;
  return <span className={value > 0 ? 'ops-down' : 'ops-up'}>{value > 0 ? '▲' : '▼'} {num(Math.abs(value), 1)}%</span>;
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return (
    <span className="ops-spark" title="최근 가격 추이">
      {values.map((value, index) => (
        <i key={index} style={{ height: `${high > low ? 20 + (80 * (value - low)) / (high - low) : 50}%` }} />
      ))}
    </span>
  );
}

/** 운영 도구 테이블(drizzle/0008)이 아직 원격 DB에 없을 때 보여 준다. */
export function MigrationNeeded({ active, title }: { active: string; title: string }) {
  return (
    <OpsShell active={active} title={title} description="운영 도구용 DB 테이블을 불러오지 못했습니다.">
      <p className="error">
        DB 마이그레이션이 아직 적용되지 않았을 수 있습니다. 프로젝트 폴더에서{' '}
        <code>npx wrangler d1 migrations apply somimall-db --remote</code>를 실행한 뒤 새로고침해 주세요.
      </p>
    </OpsShell>
  );
}

export function Kpi({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="ops-kpi">
      <span>{label}</span>
      <b>{value}</b>
      {children}
    </div>
  );
}
