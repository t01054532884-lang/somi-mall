import {
  getNaverAuthConfig,
  naverReturnCookie,
  naverStateCookie,
} from '@/app/google-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { clientId } = getNaverAuthConfig();
  const requestUrl = new URL(request.url);
  const redirectUri = new URL('/api/auth/naver/callback', requestUrl.origin);
  const state = crypto.randomUUID();
  const returnTo = requestUrl.searchParams.get('returnTo') ?? '/account';
  const naverUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
  naverUrl.searchParams.set('response_type', 'code');
  naverUrl.searchParams.set('client_id', clientId);
  naverUrl.searchParams.set('redirect_uri', redirectUri.toString());
  naverUrl.searchParams.set('state', state);

  const secure = requestUrl.protocol === 'https:';
  const headers = new Headers({ Location: naverUrl.toString() });
  headers.append('Set-Cookie', naverStateCookie(state, secure));
  headers.append('Set-Cookie', naverReturnCookie(returnTo, secure));
  return new Response(null, { status: 302, headers });
}
