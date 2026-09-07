import { env } from 'cloudflare:workers';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'somimall_session';
export const OAUTH_STATE_COOKIE = 'somimall_google_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

type RuntimeSecrets = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
};

export type MemberSession = {
  memberId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export function getGoogleAuthConfig() {
  const runtime = env as unknown as RuntimeSecrets;
  const clientId = runtime.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    runtime.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  const authSecret = runtime.AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!clientId || !clientSecret || !authSecret) {
    throw new Error('Google login environment variables are not configured.');
  }
  return { clientId, clientSecret, authSecret };
}

export async function verifyGoogleIdToken(idToken: string) {
  const { clientId } = getGoogleAuthConfig();
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });
  if (
    !payload.sub ||
    typeof payload.email !== 'string' ||
    payload.email_verified !== true
  ) {
    throw new Error('Google account does not have a verified email address.');
  }
  return {
    providerUserId: payload.sub,
    email: payload.email.toLowerCase(),
    displayName:
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : payload.email,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture : null,
  };
}

export async function createSessionToken(session: MemberSession) {
  const { authSecret } = getGoogleAuthConfig();
  return new SignJWT({
    email: session.email,
    name: session.displayName,
    picture: session.avatarUrl,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.memberId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(authSecret));
}

export async function getMemberSession(): Promise<MemberSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { authSecret } = getGoogleAuthConfig();
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(authSecret),
      { algorithms: ['HS256'] },
    );
    if (
      !payload.sub ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string'
    ) {
      return null;
    }
    return {
      memberId: payload.sub,
      email: payload.email,
      displayName: payload.name,
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean) {
  return serializeCookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS, secure);
}

export function clearSessionCookie(secure: boolean) {
  return serializeCookie(SESSION_COOKIE, '', 0, secure);
}

export function stateCookie(state: string, secure: boolean) {
  return serializeCookie(OAUTH_STATE_COOKIE, state, 600, secure);
}

export function clearStateCookie(secure: boolean) {
  return serializeCookie(OAUTH_STATE_COOKIE, '', 0, secure);
}

export function readCookie(request: Request, name: string) {
  for (const pair of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(pair.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function serializeCookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join('; ');
}
