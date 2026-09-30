import { createSessionToken, safeReturnTo, sessionCookie } from '@/app/google-auth';
import {
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  burnPasswordCheck,
  sameOrigin,
  verifyPassword,
} from '@/app/local-auth';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

type LoginBody = { loginId?: string; password?: string; returnTo?: string };
type MemberRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  failed_logins: number;
  locked: number;
  status: string;
};

const FAILED = '아이디 또는 비밀번호가 맞지 않습니다.';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: '잘못된 요청입니다.' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const loginId = String(body.loginId ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!loginId || !password) return Response.json({ error: FAILED }, { status: 401 });

  const db = getD1();
  const member = await db
    .prepare(
      `SELECT id, email, display_name, password_hash, failed_logins, status,
        (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS locked
      FROM members WHERE auth_provider = 'local' AND provider_user_id = ?`,
    )
    .bind(loginId)
    .first<MemberRow>();

  if (!member?.password_hash) {
    await burnPasswordCheck(password);
    return Response.json({ error: FAILED }, { status: 401 });
  }
  if (member.locked)
    return Response.json(
      { error: `로그인에 여러 번 실패해 ${LOCK_MINUTES}분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.` },
      { status: 429 },
    );
  if (member.status !== 'active')
    return Response.json({ error: '이용이 제한된 계정입니다.' }, { status: 403 });

  if (!(await verifyPassword(password, member.password_hash))) {
    const failures = member.failed_logins + 1;
    await db
      .prepare(
        failures >= MAX_FAILED_LOGINS
          ? `UPDATE members SET failed_logins = 0, locked_until = datetime('now', '+${LOCK_MINUTES} minutes') WHERE id = ?`
          : 'UPDATE members SET failed_logins = failed_logins + 1 WHERE id = ?',
      )
      .bind(member.id)
      .run();
    return Response.json({ error: FAILED }, { status: 401 });
  }

  await db
    .prepare(
      'UPDATE members SET failed_logins = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
    .bind(member.id)
    .run();

  const token = await createSessionToken({
    memberId: member.id,
    email: member.email,
    displayName: member.display_name,
    avatarUrl: null,
  });
  const secure = new URL(request.url).protocol === 'https:';
  return Response.json(
    { ok: true, returnTo: safeReturnTo(body.returnTo ?? '/account') },
    { headers: { 'Set-Cookie': sessionCookie(token, secure) } },
  );
}
