"""Admin JWT authentication."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import jsonify, request

from config import ADMIN_EMAIL, ADMIN_PASSWORD, JWT_EXPIRE_HOURS, JWT_SECRET

ALGORITHM = "HS256"


def admin_configured() -> bool:
    return bool(ADMIN_EMAIL and ADMIN_PASSWORD and JWT_SECRET)


def verify_admin_credentials(email: str, password: str) -> bool:
    if not admin_configured():
        return False
    return secrets.compare_digest(email.strip().lower(), ADMIN_EMAIL.lower()) and secrets.compare_digest(
        password, ADMIN_PASSWORD
    )


def create_access_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": email.lower(),
        "role": "admin",
        "exp": expires,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    if not token or not JWT_SECRET:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def token_from_request() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return request.args.get("token") or None


def require_admin(f):
    """Protect Flask routes — admin JWT required."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not admin_configured():
            return jsonify({"error": "Admin auth not configured on server"}), 503

        token = token_from_request()
        payload = decode_token(token) if token else None
        if not payload or payload.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 401

        request.admin_user = payload.get("sub")  # type: ignore[attr-defined]
        return f(*args, **kwargs)

    return decorated
