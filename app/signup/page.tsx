/* oxlint-disable next/no-html-link-for-pages */
import { redirect } from 'next/navigation';
import { getMemberSession, safeReturnTo } from '@/app/google-auth';
import SignupForm from './signup-form';

export const dynamic = 'force-dynamic';

type SignupPageProps = {
  searchParams?: Promise<{ returnTo?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params?.returnTo ?? '/account');
  if (await getMemberSession()) redirect(returnTo);

  return (
    <main className="panel login-panel member-panel">
      <a className="logo" href="/">
        CHOOSE<span>-C</span>
        <i />
      </a>
      <span className="eyebrow">JOIN US</span>
      <h1>회원가입</h1>
      <p className="account-help">
        카카오·네이버·Google 계정이 있으면{' '}
        <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>SNS 간편 로그인</a>으로
        바로 가입할 수 있습니다.
      </p>
      <SignupForm returnTo={returnTo} />
    </main>
  );
}
