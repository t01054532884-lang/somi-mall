import {
  OAUTH_STATE_COOKIE,
  clearStateCookie,
  clearReturnCookie,
  createSessionToken,
  getGoogleAuthConfig,
  readCookie,
  OAUTH_RETURN_COOKIE,
  safeReturnTo,
  sessionCookie,
  verifyGoogleIdToken,
} from '@/app/google-auth';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

type GoogleTokenResponse = { id_token?: string; error?: string };

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const secure = requestUrl.protocol === 'https:';
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const savedState = readCookie(request, OAUTH_STATE_COOKIE);
  if (!code || !state || !savedState || state !== savedState) {
    return accountError(requestUrl.origin, '로그인 요청을 확인할 수 없습니다. 다시 시도해 주세요.');
  }

  try {
    const { clientId, clientSecret } = getGoogleAuthConfig();
    const redirectUri = new URL('/api/auth/google/callback', requestUrl.origin);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri.toString(),
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokens.id_token) {
      throw new Error(tokens.error ?? 'Google token exchange failed.');
    }

    const googleUser = await verifyGoogleIdToken(tokens.id_token);
    const memberId = `google:${googleUser.providerUserId}`;
    await getD1()
      .prepare(
        `INSERT INTO members (
          id, auth_provider, provider_user_id, email, display_name, avatar_url,
          email_verified, status, created_at, updated_at, last_login_at
        ) VALUES (?, 'google', ?, ?, ?, ?, 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(auth_provider, provider_user_id) DO UPDATE SET
          email = excluded.email,
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url,
          email_verified = 1,
          updated_at = CURRENT_TIMESTAMP,
          last_login_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        memberId,
        googleUser.providerUserId,
        googleUser.email,
        googleUser.displayName,
        googleUser.avatarUrl,
      )
      .run();

    const token = await createSessionToken({
      memberId,
      email: googleUser.email,
      displayName: googleUser.displayName,
      avatarUrl: googleUser.avatarUrl,
    });
    const returnTo=safeReturnTo(readCookie(request,OAUTH_RETURN_COOKIE)??'/account');
    const headers = new Headers({Location:new URL(returnTo,requestUrl.origin).toString()});
    headers.append('Set-Cookie', sessionCookie(token, secure));
    headers.append('Set-Cookie', clearStateCookie(secure));
    headers.append('Set-Cookie', clearReturnCookie(secure));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('Google login failed', error);
    return accountError(
      requestUrl.origin,
      'Google 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

function accountError(origin: string, message: string) {
  const url = new URL('/account', origin);
  url.searchParams.set('error', message);
  return Response.redirect(url, 302);
}
