import { getGoogleAuthConfig, stateCookie } from '@/app/google-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { clientId } = getGoogleAuthConfig();
  const requestUrl = new URL(request.url);
  const redirectUri = new URL('/api/auth/google/callback', requestUrl.origin);
  const state = crypto.randomUUID();
  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleUrl.searchParams.set('client_id', clientId);
  googleUrl.searchParams.set('redirect_uri', redirectUri.toString());
  googleUrl.searchParams.set('response_type', 'code');
  googleUrl.searchParams.set('scope', 'openid email profile');
  googleUrl.searchParams.set('state', state);
  googleUrl.searchParams.set('prompt', 'select_account');

  return new Response(null, {
    status: 302,
    headers: {
      Location: googleUrl.toString(),
      'Set-Cookie': stateCookie(state, requestUrl.protocol === 'https:'),
    },
  });
}
