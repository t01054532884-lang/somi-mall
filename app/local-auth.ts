// 사이트 회원(아이디·비밀번호) 로그인. 비밀번호는 PBKDF2-SHA256으로 해시해 저장한다.
// 이메일 인증을 하지 않으므로 소셜 회원과 이메일로 합치거나 관리자(ADMIN_EMAIL)로 인정되지 않도록
// 회원 고유 주소(local_<아이디>@users.somimall.local)를 세션 이메일로 쓴다.

const ITERATIONS = 100_000; // Workers의 PBKDF2 최대 반복 횟수
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 10;

export const LOGIN_ID_PATTERN = /^[a-z0-9_]{4,20}$/;

export function localMemberEmail(loginId: string) {
  return `local_${loginId}@users.somimall.local`;
}

export function isLocalMemberEmail(email: string) {
  return email.startsWith('local_') && email.endsWith('@users.somimall.local');
}

export const PHONE_PATTERN = /^01[016789]\d{7,8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export function validateSignup(input: {
  loginId: string;
  password: string;
  passwordConfirm: string;
  name: string;
  phone: string;
  contactEmail: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeAge: boolean;
}) {
  if (!LOGIN_ID_PATTERN.test(input.loginId))
    return '아이디는 영문 소문자, 숫자, 밑줄(_)로 4~20자여야 합니다.';
  if (input.password.length < 8 || input.password.length > 64)
    return '비밀번호는 8~64자여야 합니다.';
  if (!/[A-Za-z]/.test(input.password) || !/[0-9]/.test(input.password))
    return '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  if (input.password.toLowerCase().includes(input.loginId))
    return '비밀번호에 아이디를 넣을 수 없습니다.';
  if (input.password !== input.passwordConfirm)
    return '비밀번호 확인이 일치하지 않습니다.';
  if (!input.name || input.name.length > 20) return '이름을 1~20자로 입력해 주세요.';
  if (!PHONE_PATTERN.test(input.phone)) return '휴대전화 번호를 정확히 입력해 주세요.';
  if (input.contactEmail.length > 100 || !EMAIL_PATTERN.test(input.contactEmail))
    return '이메일 주소를 정확히 입력해 주세요.';
  if (!input.agreeTerms) return '이용약관에 동의해 주세요.';
  if (!input.agreePrivacy) return '개인정보 수집·이용에 동의해 주세요.';
  if (!input.agreeAge) return '만 14세 이상만 가입할 수 있습니다.';
  return null;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false;
  const actual = await derive(password, fromBase64(salt), Number(iterations));
  const expected = fromBase64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// 존재하지 않는 아이디에도 같은 시간이 걸리도록 비교용 해시를 한 번 계산한다.
export async function burnPasswordCheck(password: string) {
  await derive(password, new Uint8Array(16), ITERATIONS);
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
