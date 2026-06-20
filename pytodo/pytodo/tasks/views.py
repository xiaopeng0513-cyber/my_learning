"""Task CRUD REST API endpoints."""

from flask import Blueprint, g, jsonify, request

from pytodo.middleware import login_required
from pytodo.models import (
    create_task,
    delete_task,
    get_task,
    get_task_row,
    get_tasks_for_user,
    update_task,
)

tasks_bp = Blueprint("tasks", __name__)


def _user_id():
    """Return the effective user_id for the current request."""
    if g.user.get("is_guest"):
        return None
    sub = g.user.get("sub")
    return int(sub) if sub and sub != "guest" else None


def _share_id():
    """Return the share_id for guest users."""
    if g.user.get("is_guest"):
        return g.user.get("username")  # "guest_<uuid>"
    return None


@tasks_bp.route("/", methods=["GET"])
@login_required
def list_tasks():
    tasks = get_tasks_for_user(_user_id())
    return jsonify({"tasks": tasks})


@tasks_bp.route("/", methods=["POST"])
@login_required
def create_task_endpoint():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    task_id = create_task(
        user_id=_user_id(),
        share_id=_share_id(),
        title=title,
        status=data.get("status", "not-started"),
        start_time=data.get("startTime"),
        deadline=data.get("deadline"),
        notes=data.get("notes"),
    )
    task = get_task(task_id)
    return jsonify({"task": task}), 201


@tasks_bp.route("/<int:task_id>", methods=["GET"])
@login_required
def get_task_endpoint(task_id):
    task = get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"task": task})


@tasks_bp.route("/<int:task_id>", methods=["PUT"])
@login_required
def update_task_endpoint(task_id):
    row = get_task_row(task_id)
    if not row:
        return jsonify({"error": "Task not found"}), 404

    # Verify ownership
    uid = _user_id()
    if row["user_id"] != uid:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    fields = {}
    for json_key, col in [
        ("title", "title"),
        ("status", "status"),
        ("startTime", "start_time"),
        ("deadline", "deadline"),
        ("notes", "notes"),
    ]:
        if json_key in data:
            fields[col] = data[json_key]

    update_task(task_id, **fields)
    task = get_task(task_id)
    return jsonify({"task": task})


@tasks_bp.route("/<int:task_id>", methods=["DELETE"])
@login_required
def delete_task_endpoint(task_id):
    row = get_task_row(task_id)
    if not row:
        return jsonify({"error": "Task not found"}), 404

    uid = _user_id()
    if row["user_id"] != uid:
        return jsonify({"error": "Forbidden"}), 403

    delete_task(task_id)
    return jsonify({"success": True})
