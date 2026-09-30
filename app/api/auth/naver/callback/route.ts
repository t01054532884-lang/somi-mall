import {
  NAVER_RETURN_COOKIE,
  NAVER_STATE_COOKIE,
  clearNaverReturnCookie,
  clearNaverStateCookie,
  createSessionToken,
  getNaverAuthConfig,
  readCookie,
  safeReturnTo,
  sessionCookie,
} from '@/app/google-auth';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

type NaverTokenResponse = { access_token?: string; error?: string; error_description?: string };
type NaverUserResponse = {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
  };
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const secure = requestUrl.protocol === 'https:';
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const savedState = readCookie(request, NAVER_STATE_COOKIE);
  if (!code || !state || !savedState || state !== savedState) {
    return accountError(
      requestUrl.origin,
      '로그인 요청을 확인할 수 없습니다. 다시 시도해 주세요.',
    );
  }

  try {
    const { clientId, clientSecret } = getNaverAuthConfig();
    const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        state,
      }),
    });
    const tokens = (await tokenResponse.json()) as NaverTokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) {
      throw new Error(tokens.error_description ?? tokens.error ?? 'Naver token exchange failed.');
    }

    const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const naverUser = (await userResponse.json()) as NaverUserResponse;
    const profile = naverUser.response;
    if (!userResponse.ok || naverUser.resultcode !== '00' || !profile?.id)
      throw new Error('Naver user lookup failed.');

    // 네이버는 이메일 인증 여부를 알려주지 않으므로, 이메일로 기존 회원과 합치거나
    // 관리자로 인정하지 않도록 회원 고유 주소를 쓴다.
    const providerUserId = profile.id;
    const email = `naver_${providerUserId}@users.somimall.local`;
    const displayName = profile.nickname ?? profile.name ?? '소미몰 회원';
    const avatarUrl = profile.profile_image ?? null;

    const existing = await getD1()
      .prepare(
        "SELECT id FROM members WHERE auth_provider = 'naver' AND provider_user_id = ?",
      )
      .bind(providerUserId)
      .first<{ id: string }>();
    const memberId = existing?.id ?? `naver:${providerUserId}`;

    if (existing) {
      await getD1()
        .prepare(
          'UPDATE members SET display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
        )
        .bind(displayName, avatarUrl, memberId)
        .run();
    } else {
      await getD1()
        .prepare(
          `INSERT INTO members (
            id, auth_provider, provider_user_id, email, display_name, avatar_url,
            email_verified, status, created_at, updated_at, last_login_at
          ) VALUES (?, 'naver', ?, ?, ?, ?, 0, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        )
        .bind(memberId, providerUserId, email, displayName, avatarUrl)
        .run();
    }

    const token = await createSessionToken({
      memberId,
      email,
      displayName,
      avatarUrl,
    });
    const returnTo = safeReturnTo(
      readCookie(request, NAVER_RETURN_COOKIE) ?? '/account',
    );
    const headers = new Headers({
      Location: new URL(returnTo, requestUrl.origin).toString(),
    });
    headers.append('Set-Cookie', sessionCookie(token, secure));
    headers.append('Set-Cookie', clearNaverStateCookie(secure));
    headers.append('Set-Cookie', clearNaverReturnCookie(secure));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('Naver login failed', error);
    return accountError(
      requestUrl.origin,
      '네이버 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

function accountError(origin: string, message: string) {
  const url = new URL('/account', origin);
  url.searchParams.set('error', message);
  return Response.redirect(url, 302);
}
