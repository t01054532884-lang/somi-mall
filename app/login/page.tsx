/* oxlint-disable next/no-html-link-for-pages */
import { safeReturnTo } from '@/app/google-auth';

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    returnTo?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params?.returnTo ?? '/account');
  const encodedReturnTo = encodeURIComponent(returnTo);

  return (
    <main className="panel login-panel">
      <a className="logo" href="/">
        somi<span>mall</span>
        <i />
      </a>
      <span className="eyebrow">MEMBER LOGIN</span>
      <h1>소미몰 로그인</h1>
      {params?.notice === 'member' ? (
        <p className="note">회원 기능입니다. 로그인 후 이용해 주세요.</p>
      ) : null}
      {params?.error ? <p className="error">{params.error}</p> : null}
      <p>간편 로그인으로 가입하고 장바구니, 쿠폰, 리뷰 기능을 이용해 보세요.</p>
      <div className="auth-buttons">
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
      </div>
      <p className="account-help">
        로그인 시 회원 확인에 필요한 기본 프로필 정보를 안전하게 저장합니다.
      </p>
      <p>
        <a href={returnTo}>← 이전 화면으로</a>
      </p>
    </main>
  );
}
