"""관리자 비밀번호 로그인과 서명된 세션 쿠키."""

import hashlib
import hmac
import os
import time

COOKIE_NAME = "somi_traffic"
SESSION_SECONDS = 60 * 60 * 24 * 7
_failures: dict[str, list[float]] = {}


def admin_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", "")


def _secret() -> bytes:
    secret = os.environ.get("SECRET_KEY") or "somi-traffic:" + admin_password()
    return hashlib.sha256(secret.encode()).digest()


def make_session() -> str:
    expires = str(int(time.time()) + SESSION_SECONDS)
    signature = hmac.new(_secret(), expires.encode(), hashlib.sha256).hexdigest()
    return f"{expires}.{signature}"


def valid_session(value: str | None) -> bool:
    if not value or "." not in value or not admin_password():
        return False
    expires, signature = value.split(".", 1)
    expected = hmac.new(_secret(), expires.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected) and expires.isdigit() and int(expires) > time.time()


def check_password(password: str, client: str) -> bool:
    """10분 안에 5번 틀리면 잠시 막는다."""
    now = time.time()
    recent = [t for t in _failures.get(client, []) if now - t < 600]
    if len(recent) >= 5:
        _failures[client] = recent
        return False
    if admin_password() and hmac.compare_digest(password.encode(), admin_password().encode()):
        _failures.pop(client, None)
        return True
    _failures[client] = recent + [now]
    return False
