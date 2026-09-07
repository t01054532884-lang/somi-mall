/* oxlint-disable next/no-html-link-for-pages, next/no-img-element */
import { getMemberSession } from '../google-auth';

export const dynamic = 'force-dynamic';

type AccountPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function Account({ searchParams }: AccountPageProps) {
  const user = await getMemberSession();
  const error = (await searchParams)?.error;
  return (
    <main className="panel">
      <a className="logo" href="/">
        somimall<i />
      </a>
      <h1>마이 소미몰</h1>
      {error ? <p className="error">{error}</p> : null}
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
          <div className="row"><div><b>주문 내역</b><p>아직 주문 내역이 없습니다.</p></div></div>
          <div className="row"><div><b>찜한 상품</b><p>마음에 드는 상품을 모아보세요.</p></div></div>
          <form action="/api/auth/logout" method="post">
            <button className="solid" type="submit">로그아웃</button>
          </form>
        </>
      ) : (
        <>
          <p>Google 계정으로 간편하게 가입하고 주문과 찜 목록을 어느 기기에서나 확인하세요.</p>
          <a className="google-signin" href="/api/auth/google/start">
            <span aria-hidden="true">G</span>Google 계정으로 계속하기
          </a>
          <p className="account-help">회원 확인을 위해 Google에서 이름, 이메일, 프로필 사진을 받아 안전하게 저장합니다.</p>
        </>
      )}
      <p><a href="/">← 쇼핑 계속하기</a></p>
    </main>
  );
}
