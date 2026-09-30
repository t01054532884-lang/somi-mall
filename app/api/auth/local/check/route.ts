import { LOGIN_ID_PATTERN } from '@/app/local-auth';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

// 회원가입 화면의 아이디 중복확인
export async function GET(request: Request) {
  const loginId = (new URL(request.url).searchParams.get('loginId') ?? '').trim().toLowerCase();
  if (!LOGIN_ID_PATTERN.test(loginId))
    return Response.json({ available: false, message: '영문 소문자, 숫자, 밑줄(_)로 4~20자' });
  const taken = await getD1()
    .prepare("SELECT 1 FROM members WHERE auth_provider = 'local' AND provider_user_id = ?")
    .bind(loginId)
    .first();
  return Response.json(
    taken
      ? { available: false, message: '이미 사용 중인 아이디입니다.' }
      : { available: true, message: '사용할 수 있는 아이디입니다.' },
  );
}
