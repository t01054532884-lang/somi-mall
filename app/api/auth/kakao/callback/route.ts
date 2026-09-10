import {
  KAKAO_RETURN_COOKIE,
  KAKAO_STATE_COOKIE,
  clearKakaoReturnCookie,
  clearKakaoStateCookie,
  createSessionToken,
  getKakaoAuthConfig,
  readCookie,
  safeReturnTo,
  sessionCookie,
} from '@/app/google-auth';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

type KakaoTokenResponse = { access_token?: string; error?: string };
type KakaoUserResponse = {
  id: number;
  properties?: { nickname?: string; profile_image?: string };
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    profile?: { nickname?: string; profile_image_url?: string };
  };
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const secure = requestUrl.protocol === 'https:';
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const savedState = readCookie(request, KAKAO_STATE_COOKIE);
  if (!code || !state || !savedState || state !== savedState) {
    return accountError(
      requestUrl.origin,
      '로그인 요청을 확인할 수 없습니다. 다시 시도해 주세요.',
    );
  }

  try {
    const { clientId, clientSecret } = getKakaoAuthConfig();
    const redirectUri = new URL('/api/auth/kakao/callback', requestUrl.origin);
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri.toString(),
        code,
      }),
    });
    const tokens = (await tokenResponse.json()) as KakaoTokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) {
      throw new Error(tokens.error ?? 'Kakao token exchange failed.');
    }

    const userResponse = await fetch(
      'https://kapi.kakao.com/v2/user/me?secure_resource=true',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    const kakaoUser = (await userResponse.json()) as KakaoUserResponse;
    if (!userResponse.ok || !kakaoUser.id)
      throw new Error('Kakao user lookup failed.');

    const providerUserId = String(kakaoUser.id);
    const account = kakaoUser.kakao_account;
    const verifiedEmail =
      account?.email &&
      account.is_email_valid !== false &&
      account.is_email_verified !== false
        ? account.email.toLowerCase()
        : null;
    const email =
      verifiedEmail ?? `kakao_${providerUserId}@users.somimall.local`;
    const displayName =
      account?.profile?.nickname ??
      kakaoUser.properties?.nickname ??
      '소미몰 회원';
    const avatarUrl =
      account?.profile?.profile_image_url ??
      kakaoUser.properties?.profile_image ??
      null;

    const existingByProvider = await getD1()
      .prepare(
        "SELECT id FROM members WHERE auth_provider = 'kakao' AND provider_user_id = ?",
      )
      .bind(providerUserId)
      .first<{ id: string }>();
    const existingByEmail = verifiedEmail
      ? await getD1()
          .prepare('SELECT id FROM members WHERE email = ?')
          .bind(verifiedEmail)
          .first<{ id: string }>()
      : null;
    const memberId =
      existingByProvider?.id ??
      existingByEmail?.id ??
      `kakao:${providerUserId}`;

    if (existingByProvider || existingByEmail) {
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
          ) VALUES (?, 'kakao', ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        )
        .bind(
          memberId,
          providerUserId,
          email,
          displayName,
          avatarUrl,
          verifiedEmail ? 1 : 0,
        )
        .run();
    }

    const token = await createSessionToken({
      memberId,
      email,
      displayName,
      avatarUrl,
    });
    const returnTo = safeReturnTo(
      readCookie(request, KAKAO_RETURN_COOKIE) ?? '/account',
    );
    const headers = new Headers({
      Location: new URL(returnTo, requestUrl.origin).toString(),
    });
    headers.append('Set-Cookie', sessionCookie(token, secure));
    headers.append('Set-Cookie', clearKakaoStateCookie(secure));
    headers.append('Set-Cookie', clearKakaoReturnCookie(secure));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('Kakao login failed', error);
    return accountError(
      requestUrl.origin,
      '카카오 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

function accountError(origin: string, message: string) {
  const url = new URL('/account', origin);
  url.searchParams.set('error', message);
  return Response.redirect(url, 302);
}
