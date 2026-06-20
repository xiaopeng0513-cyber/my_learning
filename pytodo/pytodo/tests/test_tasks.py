"""Tests for task CRUD endpoints."""


class TestTasks:
    def test_create_task(self, client, auth_header):
        resp = client.post(
            "/api/tasks/",
            json={
                "title": "My first task",
                "status": "in-progress",
                "startTime": "2025-01-01T10:00",
                "deadline": "2025-01-10T18:00",
                "notes": "Testing notes",
            },
            headers=auth_header,
        )
        assert resp.status_code == 201
        task = resp.get_json()["task"]
        assert task["title"] == "My first task"
        assert task["status"] == "in-progress"
        assert task["notes"] == "Testing notes"

    def test_create_task_without_title(self, client, auth_header):
        resp = client.post("/api/tasks/", json={}, headers=auth_header)
        assert resp.status_code == 400

    def test_list_tasks(self, client, auth_header):
        # Create 3 tasks
        for i in range(3):
            client.post(
                "/api/tasks/",
                json={"title": f"Task {i}"},
                headers=auth_header,
            )
        resp = client.get("/api/tasks/", headers=auth_header)
        assert resp.status_code == 200
        tasks = resp.get_json()["tasks"]
        assert len(tasks) == 3

    def test_get_single_task(self, client, auth_header):
        create_resp = client.post(
            "/api/tasks/",
            json={"title": "Single task"},
            headers=auth_header,
        )
        task_id = create_resp.get_json()["task"]["id"]

        resp = client.get(f"/api/tasks/{task_id}", headers=auth_header)
        assert resp.status_code == 200
        assert resp.get_json()["task"]["title"] == "Single task"

    def test_update_task(self, client, auth_header):
        create_resp = client.post(
            "/api/tasks/",
            json={"title": "Old title", "status": "not-started"},
            headers=auth_header,
        )
        task_id = create_resp.get_json()["task"]["id"]

        resp = client.put(
            f"/api/tasks/{task_id}",
            json={"title": "New title", "status": "completed"},
            headers=auth_header,
        )
        assert resp.status_code == 200
        task = resp.get_json()["task"]
        assert task["title"] == "New title"
        assert task["status"] == "completed"

    def test_delete_task(self, client, auth_header):
        create_resp = client.post(
            "/api/tasks/",
            json={"title": "To be deleted"},
            headers=auth_header,
        )
        task_id = create_resp.get_json()["task"]["id"]

        resp = client.delete(f"/api/tasks/{task_id}", headers=auth_header)
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        # Verify deleted
        get_resp = client.get(f"/api/tasks/{task_id}", headers=auth_header)
        assert get_resp.status_code == 404

    def test_cannot_access_other_user_task(self, client):
        # User A creates a task
        client.post(
            "/api/auth/register",
            json={"username": "userA", "password": "passA1234"},
        )
        a_login = client.post(
            "/api/auth/login",
            json={"username": "userA", "password": "passA1234"},
        )
        a_token = a_login.get_json()["token"]
        a_header = {"Authorization": "Bearer " + a_token}

        create_resp = client.post(
            "/api/tasks/",
            json={"title": "User A task"},
            headers=a_header,
        )
        task_id = create_resp.get_json()["task"]["id"]

        # User B tries to update it
        client.post(
            "/api/auth/register",
            json={"username": "userB", "password": "passB1234"},
        )
        b_login = client.post(
            "/api/auth/login",
            json={"username": "userB", "password": "passB1234"},
        )
        b_token = b_login.get_json()["token"]
        b_header = {"Authorization": "Bearer " + b_token}

        resp = client.put(
            f"/api/tasks/{task_id}",
            json={"title": "Hacked!"},
            headers=b_header,
        )
        assert resp.status_code == 403
