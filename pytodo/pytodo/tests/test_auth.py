"""Tests for authentication endpoints."""


class TestRegister:
    def test_register_success(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"username": "newuser", "password": "pass1234"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert "token" in data
        assert data["user"]["username"] == "newuser"
        assert data["user"]["id"] is not None

    def test_register_duplicate(self, client):
        client.post(
            "/api/auth/register",
            json={"username": "dup", "password": "pass1234"},
        )
        resp = client.post(
            "/api/auth/register",
            json={"username": "dup", "password": "pass1234"},
        )
        assert resp.status_code == 409

    def test_register_short_username(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"username": "a", "password": "pass1234"},
        )
        assert resp.status_code == 400

    def test_register_short_password(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"username": "gooduser", "password": "ab"},
        )
        assert resp.status_code == 400


class TestLogin:
    def test_login_success(self, auth_header):
        # auth_header fixture already registers + logs in successfully
        assert auth_header["Authorization"].startswith("Bearer ")

    def test_login_wrong_password(self, client):
        client.post(
            "/api/auth/register",
            json={"username": "logintest", "password": "correct"},
        )
        resp = client.post(
            "/api/auth/login",
            json={"username": "logintest", "password": "wrong"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"username": "nobody", "password": "pass1234"},
        )
        assert resp.status_code == 401

    def test_password_hash_consistency(self, client):
        """Verify no 'password error' bug — same password logs in after register."""
        client.post(
            "/api/auth/register",
            json={"username": "hashcheck", "password": "mypassword"},
        )
        # Login immediately (same session)
        resp = client.post(
            "/api/auth/login",
            json={"username": "hashcheck", "password": "mypassword"},
        )
        assert resp.status_code == 200
        # Verify second login also works
        resp2 = client.post(
            "/api/auth/login",
            json={"username": "hashcheck", "password": "mypassword"},
        )
        assert resp2.status_code == 200


class TestGuest:
    def test_guest_session(self, client):
        resp = client.post("/api/auth/guest")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "token" in data
        assert data["user"]["username"].startswith("guest_")
        assert data["user"]["id"] is None


class TestMe:
    def test_me_authenticated(self, client, auth_header):
        resp = client.get("/api/auth/me", headers=auth_header)
        assert resp.status_code == 200
        assert resp.get_json()["user"]["username"] == "testuser"

    def test_me_unauthenticated(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401
