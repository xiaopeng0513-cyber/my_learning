"""Database connection and initialization for PyTodo."""

import os
import sqlite3

from flask import current_app, g


def get_db_path(app):
    """Determine the database file path."""
    config_path = app.config.get("DATABASE")
    if config_path:
        return config_path
    db_dir = os.path.join(os.path.expanduser("~"), ".pytodo")
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "pytodo.db")


def get_db():
    """Get a database connection for the current request."""
    if "db" not in g:
        db_path = current_app.config.get("_DB_PATH")
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


def close_db(exception=None):
    """Close the database connection at the end of a request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app=None, db_path=None):
    """Create tables if they do not exist.

    Can be called with an app (which sets _DB_PATH on the config) or with a
    raw db_path for testing / direct use.
    """
    if db_path is None:
        db_path = get_db_path(app)

    if app is not None:
        app.config["_DB_PATH"] = db_path

    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    NOT NULL UNIQUE,
            password     TEXT    NOT NULL,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER,
            share_id     TEXT,
            title        TEXT    NOT NULL,
            status       TEXT    NOT NULL DEFAULT 'not-started',
            start_time   TEXT,
            deadline     TEXT,
            notes        TEXT,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS shares (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            token        TEXT    NOT NULL UNIQUE,
            data         TEXT    NOT NULL,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_share_id ON tasks(share_id);
        CREATE INDEX IF NOT EXISTS idx_shares_token   ON shares(token);
        """
    )
    conn.commit()
    conn.close()


def init_app(app):
    """Register database teardown with the Flask app."""
    app.teardown_appcontext(close_db)
