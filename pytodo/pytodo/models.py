"""Typed query helpers for PyTodo database operations."""

from datetime import datetime, timezone

from pytodo.db import get_db


# ---- Users ----

def get_user_by_username(username):
    db = get_db()
    return db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()


def get_user_by_id(user_id):
    db = get_db()
    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def create_user(username, password_hash):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.execute(
        "INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)",
        (username, password_hash, now),
    )
    db.commit()
    return cursor.lastrowid


# ---- Tasks ----

def _task_to_dict(row):
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "startTime": row["start_time"],
        "deadline": row["deadline"],
        "notes": row["notes"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def get_tasks_for_user(user_id):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC", (user_id,)
    ).fetchall()
    return [_task_to_dict(r) for r in rows]


def get_task(task_id):
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return _task_to_dict(row) if row else None


def get_task_row(task_id):
    """Return raw Row object (for ownership check)."""
    db = get_db()
    return db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()


def create_task(user_id, share_id, title, status, start_time, deadline, notes):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.execute(
        """INSERT INTO tasks
           (user_id, share_id, title, status, start_time, deadline, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user_id, share_id, title, status, start_time, deadline, notes, now, now),
    )
    db.commit()
    return cursor.lastrowid


def update_task(task_id, **fields):
    if not fields:
        return
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [task_id]
    db = get_db()
    db.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", values)
    db.commit()


def delete_task(task_id):
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()


# ---- Shares ----

def create_share(token, data):
    db = get_db()
    db.execute("INSERT INTO shares (token, data) VALUES (?, ?)", (token, data))
    db.commit()


def get_share(token):
    db = get_db()
    return db.execute("SELECT * FROM shares WHERE token = ?", (token,)).fetchone()
