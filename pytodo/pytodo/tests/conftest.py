"""Pytest fixtures for PyTodo tests."""

import os
import tempfile

import pytest

from pytodo.app import create_app
from pytodo.db import init_db


@pytest.fixture
def app():
    """Create an app with a temporary database for testing."""
    db_fd, db_path = tempfile.mkstemp()
    config = {
        "TESTING": True,
        "SECRET_KEY": "test-secret-key-" + ("x" * 32),
        "DATABASE": db_path,
        "JWT_EXPIRY_DAYS": 1,
    }
    app = create_app(config)
    with app.app_context():
        init_db(app)
    yield app
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def auth_header(client):
    """Register a test user and return the Authorization header dict."""
    client.post(
        "/api/auth/register",
        json={"username": "testuser", "password": "test1234"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "test1234"},
    )
    token = resp.get_json()["token"]
    return {"Authorization": "Bearer " + token}
