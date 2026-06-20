"""Shared JWT utilities — key derivation, encode, decode."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app


def _get_jwt_key():
    """Return a stable 32+ byte key for HS256 signing.

    HS256 requires >= 256 bits (32 bytes).  If the configured SECRET_KEY
    is shorter we derive a longer key so both encoding and decoding use
    the same derivation.
    """
    key = current_app.config.get("SECRET_KEY", "")
    if not key:
        key = str(uuid.uuid4())
    # Ensure at least 32 bytes for HS256
    while len(key) < 32:
        key = key + key
    return key[:64]


def encode_token(user_id, username, is_guest=False):
    """Create a signed JWT.  Must be called within a Flask request context."""
    # JWT 'sub' MUST be a string (RFC 7519)
    sub = str(user_id) if user_id is not None else "guest"
    payload = {
        "sub": sub,
        "username": username,
        "is_guest": is_guest,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc)
        + timedelta(days=current_app.config.get("JWT_EXPIRY_DAYS", 30)),
    }
    return jwt.encode(payload, _get_jwt_key(), algorithm="HS256")


def decode_token(token):
    """Decode + verify a JWT.  Returns payload dict or raises jwt.*Error.

    Must be called within a Flask request context.
    """
    return jwt.decode(token, _get_jwt_key(), algorithms=["HS256"])
