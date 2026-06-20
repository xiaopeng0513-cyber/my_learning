"""Share endpoints: create share link, resolve shared data."""

import json
import secrets

from flask import Blueprint, jsonify, redirect, request

from pytodo.models import create_share, get_share

share_bp = Blueprint("share", __name__)


def _generate_token():
    return secrets.token_urlsafe(6)  # 8 characters


@share_bp.route("/", methods=["POST"])
def create_share_endpoint():
    data = request.get_json(silent=True) or {}
    tasks = data.get("tasks", [])
    if not tasks:
        return jsonify({"error": "No tasks to share"}), 400

    token = _generate_token()
    # Guard against (extremely unlikely) collision
    while get_share(token):
        token = _generate_token()

    create_share(token, json.dumps(tasks, ensure_ascii=False))
    return (
        jsonify(
            {
                "token": token,
                "url": request.host_url.rstrip("/") + "/s/" + token,
            }
        ),
        201,
    )


@share_bp.route("/<token>", methods=["GET"])
def resolve_share(token):
    share = get_share(token)
    if not share:
        return jsonify({"error": "Share not found"}), 404
    return jsonify({"tasks": json.loads(share["data"])})


def register_share_redirect(app):
    """Register the /s/<token> short-link route on the main app."""

    @app.route("/s/<token>")
    def share_redirect(token):
        return redirect(f"/?share={token}")
