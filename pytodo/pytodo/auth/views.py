"""Authentication endpoints: register, login, guest, me."""

import uuid

from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from pytodo.jwt_helper import encode_token
from pytodo.middleware import login_required
from pytodo.models import create_user, get_user_by_username

auth_bp = Blueprint("auth", __name__)


def _make_token(user_id, username, is_guest=False):
    """Create a JWT for the given user/guest."""
    return encode_token(
        user_id=user_id,
        username=username,
        is_guest=is_guest,
    )


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or len(username) < 2:
        return jsonify({"error": "Username must be at least 2 characters"}), 400
    if not password or len(password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400
    if get_user_by_username(username):
        return jsonify({"error": "Username already taken"}), 409

    user_id = create_user(username, generate_password_hash(password))
    token = _make_token(user_id, username)
    return (
        jsonify({"token": token, "user": {"id": user_id, "username": username}}),
        201,
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = get_user_by_username(username)
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    token = _make_token(user["id"], username)
    return jsonify({"token": token, "user": {"id": user["id"], "username": username}})


@auth_bp.route("/guest", methods=["POST"])
def guest():
    guest_id = str(uuid.uuid4())[:8]
    token = _make_token(None, f"guest_{guest_id}", is_guest=True)
    return (
        jsonify({"token": token, "user": {"id": None, "username": f"guest_{guest_id}"}}),
        200,
    )


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user": g.user})
