'use client';
import { useEffect, useState } from 'react';

const SAVED_ID_KEY = 'choosec_saved_login_id';

export default function MemberLoginForm({ returnTo }: { returnTo: string }) {
  const [loginId, setLoginId] = useState('');
  const [saveId, setSaveId] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_ID_KEY);
      if (saved) {
        setLoginId(saved);
        setSaveId(true);
      }
    } catch {}
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      if (saveId) localStorage.setItem(SAVED_ID_KEY, loginId.trim().toLowerCase());
      else localStorage.removeItem(SAVED_ID_KEY);
    } catch {}
    const res = await fetch('/api/auth/local/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loginId, password: data.get('password'), returnTo }),
    });
    const result = (await res.json().catch(() => ({}))) as { error?: string; returnTo?: string };
    if (res.ok) {
      location.href = result.returnTo ?? '/account';
      return;
    }
    setBusy(false);
    setError(result.error ?? '로그인 중 문제가 발생했습니다.');
  }

  return (
    <form className="member-form" onSubmit={submit}>
      <label className="field">
        아이디
        <input
          name="loginId"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />
      </label>
      <label className="field">
        비밀번호
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <label className="member-check">
        <input type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)} />
        아이디 저장
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="solid member-submit" disabled={busy}>
        {busy ? '확인 중…' : '로그인'}
      </button>
      <div className="member-links">
        <a href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>회원가입</a>
      </div>
    </form>
  );
}
