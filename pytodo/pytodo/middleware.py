"""Authentication middleware (decorators) for PyTodo."""

from functools import wraps

import jwt
from flask import g, jsonify, request

from pytodo.jwt_helper import decode_token


def login_required(f):
    """Decorate a view to require a valid JWT Bearer token."""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if token is None:
            return jsonify({"error": "Authentication required"}), 401
        try:
            g.user = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)

    return decorated


def login_optional(f):
    """Decorate a view; attach g.user if a valid token is present, else g.user = None."""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if token:
            try:
                g.user = decode_token(token)
            except jwt.InvalidTokenError:
                g.user = None
        else:
            g.user = None
        return f(*args, **kwargs)

    return decorated


def _extract_token():
    """Pull the Bearer token from the Authorization header."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    return None
