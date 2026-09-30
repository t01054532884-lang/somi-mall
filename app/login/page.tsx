/* oxlint-disable next/no-html-link-for-pages */
import { safeReturnTo } from '@/app/google-auth';
import MemberLoginForm from './member-login-form';

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
    <main className="panel login-panel member-panel">
      <a className="logo" href="/">
        CHOOSE<span>-C</span>
        <i />
      </a>
      <span className="eyebrow">MEMBER LOGIN</span>
      <h1>로그인</h1>
      {params?.notice === 'member' ? (
        <p className="note">회원 기능입니다. 로그인 후 이용해 주세요.</p>
      ) : null}
      {params?.error ? <p className="error">{params.error}</p> : null}
      <MemberLoginForm returnTo={returnTo} />
      <div className="auth-divider member-sns-title">
        <span>SNS 간편 로그인</span>
      </div>
      <div className="auth-buttons">
        <a
          className="kakao-signin"
          href={`/api/auth/kakao/start?returnTo=${encodedReturnTo}`}
        >
          <span aria-hidden="true">K</span>카카오로 계속하기
        </a>
        <a
          className="naver-signin"
          href={`/api/auth/naver/start?returnTo=${encodedReturnTo}`}
        >
          <span aria-hidden="true">N</span>네이버로 계속하기
        </a>
        <a
          className="google-signin"
          href={`/api/auth/google/start?returnTo=${encodedReturnTo}`}
        >
          <span aria-hidden="true">G</span>Google 계정으로 계속하기
        </a>
      </div>
      <p className="account-help">
        SNS 간편 로그인은 처음 이용할 때 자동으로 회원가입됩니다.
      </p>
      <p>
        <a href={returnTo}>← 이전 화면으로</a>
      </p>
    </main>
  );
}
