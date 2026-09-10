/* oxlint-disable next/no-html-link-for-pages, next/no-img-element */
import { getMemberSession, safeReturnTo } from '../google-auth';
import { getAdminUser } from '../admin-auth';
import { getMemberCoupon, listMemberOrders } from '@/db/orders';

export const dynamic = 'force-dynamic';

type AccountPageProps = {
  searchParams?: Promise<{ error?: string; returnTo?: string }>;
};

export default async function Account({ searchParams }: AccountPageProps) {
  const [user, admin] = await Promise.all([getMemberSession(), getAdminUser()]);
  const params = await searchParams;
  const error = params?.error;
  const returnTo = safeReturnTo(params?.returnTo ?? '/account');
  const encodedReturnTo = encodeURIComponent(returnTo);
  let orders = [] as Awaited<ReturnType<typeof listMemberOrders>>,
    coupon = null as Awaited<ReturnType<typeof getMemberCoupon>>;
  try {
    if (user)
      [orders, coupon] = await Promise.all([
        listMemberOrders(user.memberId),
        getMemberCoupon(user.memberId),
      ]);
  } catch {}
  return (
    <main className="panel">
      <a className="logo" href="/">
        somimall
        <i />
      </a>
      <h1>마이 소미몰</h1>
      {error ? <p className="error">{error}</p> : null}
      {admin ? (
        <a className="account-admin-link" href="/admin">
          <b>관리자 계정</b>
          <span>상품·리뷰·문의 관리하기 →</span>
        </a>
      ) : null}
      {user ? (
        <>
          <section className="account-profile">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <div>
              <strong>{user.displayName}님, 반가워요.</strong>
              <p>{user.email}</p>
            </div>
          </section>
          <div className="row">
            <div>
              <b>내 쿠폰</b>
              <p>
                {coupon
                  ? coupon.used
                    ? '첫 구매 쿠폰 · 사용 완료'
                    : '첫 구매 10% 할인 쿠폰 · 사용 가능'
                  : '발급받은 쿠폰이 없습니다.'}
              </p>
            </div>
          </div>
          <section className="account-orders">
            <h2>주문 내역</h2>
            {orders.map((order) => (
              <article className="row" key={order.id}>
                <div>
                  <b>{order.orderNumber}</b>
                  <p>
                    {order.items
                      .map((x) => `${x.productName} × ${x.quantity}`)
                      .join(', ')}
                  </p>
                  <small>
                    {order.status} · {order.total.toLocaleString('ko-KR')}원
                    {order.trackingNumber
                      ? ` · 로젠택배 ${order.trackingNumber}`
                      : ''}
                  </small>
                </div>
              </article>
            ))}
            {!orders.length ? <p>아직 주문 내역이 없습니다.</p> : null}
          </section>
          <div className="row">
            <div>
              <b>찜한 상품</b>
              <p>마음에 드는 상품을 모아보세요.</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="solid" type="submit">
              로그아웃
            </button>
          </form>
        </>
      ) : (
        <>
          <p>
            카카오 또는 Google 계정으로 간편하게 가입하고 주문과 찜 목록을 어느
            기기에서나 확인하세요.
          </p>
          <a
            className="kakao-signin"
            href={`/api/auth/kakao/start?returnTo=${encodedReturnTo}`}
          >
            <span aria-hidden="true">K</span>카카오로 계속하기
          </a>
          <div className="auth-divider">
            <span>또는</span>
          </div>
          <a
            className="google-signin"
            href={`/api/auth/google/start?returnTo=${encodedReturnTo}`}
          >
            <span aria-hidden="true">G</span>Google 계정으로 계속하기
          </a>
          <p className="account-help">
            회원 확인에 필요한 이름과 프로필 정보를 받아 안전하게 저장합니다.
          </p>
        </>
      )}
      <p>
        <a href="/">← 쇼핑 계속하기</a>
      </p>
    </main>
  );
}
