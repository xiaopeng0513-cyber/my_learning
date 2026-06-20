"""Tests for share endpoints."""


class TestShare:
    def test_create_share(self, client):
        tasks = [
            {
                "id": 1,
                "title": "Shared task",
                "status": "in-progress",
                "startTime": "2025-01-01T10:00",
                "deadline": "2025-01-10T18:00",
                "notes": "A shared note",
                "createdAt": "2025-01-01T00:00:00",
            }
        ]
        resp = client.post("/api/share/", json={"tasks": tasks})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "token" in data
        assert "url" in data
        assert data["url"].endswith("/s/" + data["token"])

    def test_create_share_empty(self, client):
        resp = client.post("/api/share/", json={"tasks": []})
        assert resp.status_code == 400

    def test_resolve_share(self, client):
        tasks = [{"id": 1, "title": "Test task", "status": "not-started"}]
        create_resp = client.post("/api/share/", json={"tasks": tasks})
        token = create_resp.get_json()["token"]

        # Resolve without auth
        resp = client.get(f"/api/share/{token}")
        assert resp.status_code == 200
        assert len(resp.get_json()["tasks"]) == 1
        assert resp.get_json()["tasks"][0]["title"] == "Test task"

    def test_resolve_share_not_found(self, client):
        resp = client.get("/api/share/nonexistent")
        assert resp.status_code == 404

    def test_share_redirect(self, client):
        """Short link /s/<token> redirects to /?share=<token>"""
        tasks = [{"id": 1, "title": "Redirect test"}]
        create_resp = client.post("/api/share/", json={"tasks": tasks})
        token = create_resp.get_json()["token"]

        resp = client.get(f"/s/{token}")
        assert resp.status_code == 302
        assert f"share={token}" in resp.headers["Location"]
