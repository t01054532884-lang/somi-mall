import { getGoogleAuthConfig, returnCookie, stateCookie } from '@/app/google-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { clientId } = getGoogleAuthConfig();
  const requestUrl = new URL(request.url);
  const redirectUri = new URL('/api/auth/google/callback', requestUrl.origin);
  const state = crypto.randomUUID();
  const returnTo = requestUrl.searchParams.get('returnTo') ?? '/account';
  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleUrl.searchParams.set('client_id', clientId);
  googleUrl.searchParams.set('redirect_uri', redirectUri.toString());
  googleUrl.searchParams.set('response_type', 'code');
  googleUrl.searchParams.set('scope', 'openid email profile');
  googleUrl.searchParams.set('state', state);
  googleUrl.searchParams.set('prompt', 'select_account');

  const secure = requestUrl.protocol === 'https:';
  const headers = new Headers({ Location: googleUrl.toString() });
  headers.append('Set-Cookie', stateCookie(state, secure));
  headers.append('Set-Cookie', returnCookie(returnTo, secure));
  return new Response(null, { status: 302, headers });
}
