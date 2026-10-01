'use client';
import { useState } from 'react';

type Agreements = {
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeAge: boolean;
  marketingSms: boolean;
  marketingEmail: boolean;
};

const NONE: Agreements = {
  agreeTerms: false,
  agreePrivacy: false,
  agreeAge: false,
  marketingSms: false,
  marketingEmail: false,
};

const TERMS = `제1조(목적) 이 약관은 CHOOSE-C(이하 "몰")가 제공하는 온라인 쇼핑 서비스의 이용 조건과 절차, 몰과 회원의 권리·의무를 정합니다.
제2조(회원가입) 이용자는 이 약관과 개인정보 수집·이용에 동의하고 몰이 정한 양식에 따라 회원정보를 입력해 가입합니다.
제3조(회원 탈퇴) 회원은 언제든지 탈퇴를 요청할 수 있으며, 몰은 관계 법령에 따라 즉시 처리합니다.
제4조(구매 신청과 계약 성립) 회원이 상품을 주문하고 몰이 이를 승낙하면 구매 계약이 성립합니다.
제5조(청약철회) 회원은 상품을 받은 날부터 7일 이내에 청약을 철회할 수 있습니다. 다만 회원의 책임으로 상품이 훼손된 경우 등 관계 법령이 정한 경우는 제외합니다.
제6조(회원의 의무) 회원은 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 되며, 아이디와 비밀번호 관리 책임은 회원에게 있습니다.`;

const PRIVACY = `수집 항목: 아이디, 비밀번호, 이름, 휴대전화 번호, 이메일
수집 목적: 회원 식별 및 가입 의사 확인, 주문·배송·교환·환불 처리, 고객 상담 및 공지 전달
보유 기간: 회원 탈퇴 시까지. 단, 전자상거래법 등 관계 법령에 따라 계약·결제·배송 기록은 5년, 소비자 불만·분쟁 처리 기록은 3년간 보관합니다.
동의를 거부할 수 있으나, 거부하면 회원가입이 제한됩니다.`;

export default function SignupForm({ returnTo }: { returnTo: string }) {
  const [loginId, setLoginId] = useState('');
  const [idCheck, setIdCheck] = useState<{ id: string; available: boolean; message: string } | null>(null);
  const [agree, setAgree] = useState<Agreements>(NONE);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const allAgreed = Object.values(agree).every(Boolean);
  const normalizedId = loginId.trim().toLowerCase();
  const idConfirmed = idCheck?.available === true && idCheck.id === normalizedId;

  async function checkId() {
    const res = await fetch(`/api/auth/local/check?loginId=${encodeURIComponent(normalizedId)}`);
    const result = (await res.json()) as { available: boolean; message: string };
    setIdCheck({ id: normalizedId, ...result });
  }

  function toggle(key: keyof Agreements) {
    setAgree((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!idConfirmed) {
      setError('아이디 중복확인을 해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/local/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        loginId: normalizedId,
        password: data.get('password'),
        passwordConfirm: data.get('passwordConfirm'),
        name: data.get('name'),
        phone: data.get('phone'),
        contactEmail: data.get('contactEmail'),
        ...agree,
        returnTo,
      }),
    });
    const result = (await res.json().catch(() => ({}))) as { error?: string; returnTo?: string };
    if (res.ok) {
      location.href = result.returnTo ?? '/account';
      return;
    }
    setBusy(false);
    setError(result.error ?? '가입 중 문제가 발생했습니다.');
  }

  return (
    <form className="member-form member-signup" onSubmit={submit}>
      <h2>기본 정보</h2>
      <label className="field">
        아이디 <small>영문 소문자, 숫자, 밑줄(_) 4~20자</small>
        <span className="member-inline">
          <input
            name="loginId"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <button type="button" className="member-outline" onClick={checkId} disabled={!normalizedId}>
            중복확인
          </button>
        </span>
        {idCheck && idCheck.id === normalizedId ? (
          <small className={idCheck.available ? 'member-ok' : 'error'}>{idCheck.message}</small>
        ) : null}
      </label>
      <label className="field">
        비밀번호 <small>영문과 숫자를 포함해 8자 이상</small>
        <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required />
      </label>
      <label className="field">
        비밀번호 확인
        <input name="passwordConfirm" type="password" autoComplete="new-password" required />
      </label>
      <label className="field">
        이름
        <input name="name" autoComplete="name" maxLength={20} required />
      </label>
      <label className="field">
        휴대전화
        <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01012345678" required />
      </label>
      <label className="field">
        이메일
        <input name="contactEmail" type="email" autoComplete="email" maxLength={100} required />
      </label>

      <h2>약관 동의</h2>
      <div className="member-agree">
        <label className="member-check member-check-all">
          <input
            type="checkbox"
            checked={allAgreed}
            onChange={() =>
              setAgree(
                allAgreed
                  ? NONE
                  : { agreeTerms: true, agreePrivacy: true, agreeAge: true, marketingSms: true, marketingEmail: true },
              )
            }
          />
          전체 동의합니다.
        </label>
        <p className="member-agree-note">선택 항목에 동의하지 않아도 회원가입을 할 수 있습니다.</p>
        <label className="member-check">
          <input type="checkbox" checked={agree.agreeTerms} onChange={() => toggle('agreeTerms')} />
          [필수] 이용약관 동의
        </label>
        <details className="member-terms">
          <summary>내용 보기</summary>
          <pre>{TERMS}</pre>
          <a href="/terms" target="_blank" rel="noreferrer">전문 보기</a>
        </details>
        <label className="member-check">
          <input type="checkbox" checked={agree.agreePrivacy} onChange={() => toggle('agreePrivacy')} />
          [필수] 개인정보 수집·이용 동의
        </label>
        <details className="member-terms">
          <summary>내용 보기</summary>
          <pre>{PRIVACY}</pre>
          <a href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침 전문 보기</a>
        </details>
        <label className="member-check">
          <input type="checkbox" checked={agree.agreeAge} onChange={() => toggle('agreeAge')} />
          [필수] 만 14세 이상입니다.
        </label>
        <label className="member-check">
          <input type="checkbox" checked={agree.marketingSms} onChange={() => toggle('marketingSms')} />
          [선택] 쇼핑정보 SMS 수신 동의
        </label>
        <label className="member-check">
          <input type="checkbox" checked={agree.marketingEmail} onChange={() => toggle('marketingEmail')} />
          [선택] 쇼핑정보 이메일 수신 동의
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}
      <button className="solid member-submit" disabled={busy}>
        {busy ? '가입 중…' : '회원가입'}
      </button>
    </form>
  );
}
