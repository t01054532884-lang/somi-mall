import {
  getKakaoAuthConfig,
  kakaoReturnCookie,
  kakaoStateCookie,
} from '@/app/google-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { clientId } = getKakaoAuthConfig();
  const requestUrl = new URL(request.url);
  const redirectUri = new URL('/api/auth/kakao/callback', requestUrl.origin);
  const state = crypto.randomUUID();
  const returnTo = requestUrl.searchParams.get('returnTo') ?? '/account';
  const kakaoUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  kakaoUrl.searchParams.set('client_id', clientId);
  kakaoUrl.searchParams.set('redirect_uri', redirectUri.toString());
  kakaoUrl.searchParams.set('response_type', 'code');
  kakaoUrl.searchParams.set('state', state);

  const secure = requestUrl.protocol === 'https:';
  const headers = new Headers({ Location: kakaoUrl.toString() });
  headers.append('Set-Cookie', kakaoStateCookie(state, secure));
  headers.append('Set-Cookie', kakaoReturnCookie(returnTo, secure));
  return new Response(null, { status: 302, headers });
}
