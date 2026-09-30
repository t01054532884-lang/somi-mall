import { createSessionToken, safeReturnTo, sessionCookie } from '@/app/google-auth';
import {
  hashPassword,
  localMemberEmail,
  normalizePhone,
  sameOrigin,
  validateSignup,
} from '@/app/local-auth';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

type SignupBody = {
  loginId?: string;
  password?: string;
  passwordConfirm?: string;
  name?: string;
  phone?: string;
  contactEmail?: string;
  agreeTerms?: boolean;
  agreePrivacy?: boolean;
  agreeAge?: boolean;
  marketingSms?: boolean;
  marketingEmail?: boolean;
  returnTo?: string;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: '잘못된 요청입니다.' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as SignupBody;
  const input = {
    loginId: String(body.loginId ?? '').trim().toLowerCase(),
    password: String(body.password ?? ''),
    passwordConfirm: String(body.passwordConfirm ?? ''),
    name: String(body.name ?? '').trim(),
    phone: normalizePhone(String(body.phone ?? '')),
    contactEmail: String(body.contactEmail ?? '').trim().toLowerCase(),
    agreeTerms: body.agreeTerms === true,
    agreePrivacy: body.agreePrivacy === true,
    agreeAge: body.agreeAge === true,
  };
  const invalid = validateSignup(input);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const db = getD1();
  const taken = await db
    .prepare("SELECT 1 FROM members WHERE auth_provider = 'local' AND provider_user_id = ?")
    .bind(input.loginId)
    .first();
  if (taken) return Response.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });

  const memberId = `local:${crypto.randomUUID()}`;
  const email = localMemberEmail(input.loginId);
  try {
    await db
      .prepare(
        `INSERT INTO members (
          id, auth_provider, provider_user_id, email, display_name, avatar_url,
          email_verified, status, password_hash, phone, contact_email,
          marketing_sms, marketing_email, terms_agreed_at,
          created_at, updated_at, last_login_at
        ) VALUES (?, 'local', ?, ?, ?, NULL, 0, 'active', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(
        memberId,
        input.loginId,
        email,
        input.name,
        await hashPassword(input.password),
        input.phone,
        input.contactEmail,
        body.marketingSms === true ? 1 : 0,
        body.marketingEmail === true ? 1 : 0,
      )
      .run();
  } catch (error) {
    // 동시에 같은 아이디로 가입한 경우 고유 인덱스에서 막힌다.
    if (String(error).includes('UNIQUE'))
      return Response.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
    throw error;
  }

  const token = await createSessionToken({ memberId, email, displayName: input.name, avatarUrl: null });
  const secure = new URL(request.url).protocol === 'https:';
  return Response.json(
    { ok: true, returnTo: safeReturnTo(body.returnTo ?? '/account') },
    { headers: { 'Set-Cookie': sessionCookie(token, secure) } },
  );
}
