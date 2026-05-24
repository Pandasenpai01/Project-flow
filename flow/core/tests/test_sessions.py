import json
import pytest
from datetime import timedelta
from django.utils import timezone
from core.models import Session, DailyStatistic, UserProfile, TodoItem
from django.db.utils import IntegrityError

pytestmark = pytest.mark.django_db

class TestSuiteASessionAPI:
    def test_unauthenticated_access(self, client):
        response = client.post("/api/session/start/", json.dumps({}), content_type="application/json")
        assert response.status_code == 401

        response = client.post("/api/session/stop/1/", json.dumps({}), content_type="application/json")
        assert response.status_code == 401

        response = client.get("/api/session/current/")
        assert response.status_code == 401
        
        response = client.post("/api/session/pause/1/")
        assert response.status_code == 401

        response = client.post("/api/session/resume/1/")
        assert response.status_code == 401

    def test_start_session(self, auth_client, user):
        response = auth_client.post("/api/session/start/", json.dumps({"target_duration": 3000}), content_type="application/json")
        assert response.status_code == 201
        data = response.json()
        assert data["target_duration"] == 3000
        assert data["status"] == "active"
        
        session = Session.objects.get(id=data["session_id"])
        assert session.target_duration == 3000
        assert session.user == user

    def test_start_session_negative_duration(self, auth_client):
        # negative duration should default to 1500
        response = auth_client.post("/api/session/start/", json.dumps({"target_duration": -50}), content_type="application/json")
        assert response.status_code == 201
        assert response.json()["target_duration"] == 1500

    def test_pause_resume_stop_logic(self, auth_client, user):
        # Start
        response = auth_client.post("/api/session/start/", json.dumps({}), content_type="application/json")
        session_id = response.json()["session_id"]
        
        # Pause
        response = auth_client.post(f"/api/session/pause/{session_id}/")
        assert response.status_code == 200
        assert response.json()["status"] == "paused"
        
        # Resume
        response = auth_client.post(f"/api/session/resume/{session_id}/")
        assert response.status_code == 200
        assert response.json()["status"] == "active"
        
        # Stop
        response = auth_client.post(f"/api/session/stop/{session_id}/", json.dumps({}), content_type="application/json")
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        
        # Stop again (409)
        response = auth_client.post(f"/api/session/stop/{session_id}/", json.dumps({}), content_type="application/json")
        assert response.status_code == 409

    def test_rate_session(self, auth_client, user):
        session = Session.objects.create(user=user, start_time=timezone.now(), status="completed")
        response = auth_client.post(f"/api/session/rate/{session.id}/", {"rating": 4})
        assert response.status_code == 200
        session.refresh_from_db()
        assert session.focus_quality == 4


class TestSuiteBGoalAndHistoryAPI:
    def test_update_daily_goal(self, auth_client, user):
        response = auth_client.post("/api/goal/update/", json.dumps({"goal_minutes": 150}), content_type="application/json")
        assert response.status_code == 200
        data = response.json()
        assert data["daily_goal"] == 150
        
        stat = DailyStatistic.objects.get(user=user, date=timezone.now().date())
        assert stat.daily_goal == 150

    def test_update_dream_goal(self, auth_client, user):
        response = auth_client.post("/api/dream/update/", json.dumps({"dream_goal": "Be a great dev"}), content_type="application/json")
        assert response.status_code == 200
        data = response.json()
        assert data["dream_goal"] == "Be a great dev"
        
        profile = UserProfile.objects.get(user=user)
        assert profile.dream_goal == "Be a great dev"

    def test_7day_history_array_logic(self, auth_client, user):
        today = timezone.now().date()
        DailyStatistic.objects.create(user=user, date=today, total_focus_time=3600, daily_goal=120)
        DailyStatistic.objects.create(user=user, date=today - timedelta(days=2), total_focus_time=1800, daily_goal=60)
        
        response = auth_client.get("/api/history/7days/")
        assert response.status_code == 200
        data = response.json()["data"]
        
        assert len(data) == 7
        
        today_data = next(d for d in data if d["date"] == today.isoformat())
        assert today_data["total_focus_time"] == 3600
        assert today_data["daily_goal"] == 120
        assert today_data["progress_percentage"] == 50.0  # 3600s = 60min / 120 = 50%
        
        two_days_ago = (today - timedelta(days=2)).isoformat()
        old_data = next(d for d in data if d["date"] == two_days_ago)
        assert old_data["total_focus_time"] == 1800
        assert old_data["daily_goal"] == 60
        assert old_data["progress_percentage"] == 50.0

    def test_history_clearing(self, auth_client, user):
        Session.objects.create(user=user, start_time=timezone.now())
        DailyStatistic.objects.create(user=user, date=timezone.now().date())
        
        response = auth_client.post("/api/history/clear/")
        assert response.status_code == 200
        
        assert Session.objects.filter(user=user).count() == 0
        assert DailyStatistic.objects.filter(user=user).count() == 0

class TestSuiteCModelLogic:
    def test_daily_statistic_progress_percentage(self, user):
        stat = DailyStatistic(user=user, date=timezone.now().date(), daily_goal=120)
        assert stat.progress_percentage == 0.0
        
        stat.total_focus_time = 3600  # 60 minutes
        assert stat.progress_percentage == 50.0
        
        stat.total_focus_time = 7200  # 120 minutes
        assert stat.progress_percentage == 100.0
        
        stat.total_focus_time = 14400  # 240 minutes
        assert stat.progress_percentage == 100.0  # maxes at 100

    def test_daily_statistic_unique_together(self, user):
        today = timezone.now().date()
        DailyStatistic.objects.create(user=user, date=today)
        
        with pytest.raises(IntegrityError):
            DailyStatistic.objects.create(user=user, date=today)

    def test_todo_item_crud(self, auth_client, user):
        # Create
        response = auth_client.post("/api/todos/", json.dumps({"text": "Buy milk"}), content_type="application/json")
        assert response.status_code == 201
        todo_id = response.json()["id"]
        
        # Read
        response = auth_client.get("/api/todos/")
        assert response.status_code == 200
        todos = response.json()["data"]
        assert len(todos) == 1
        assert todos[0]["text"] == "Buy milk"
        assert not todos[0]["is_completed"]
        
        # Update
        response = auth_client.patch(f"/api/todos/{todo_id}/", json.dumps({"is_completed": True, "text": "Buy almond milk"}), content_type="application/json")
        assert response.status_code == 200
        
        # Reorder
        todo2_response = auth_client.post("/api/todos/", json.dumps({"text": "Buy eggs"}), content_type="application/json")
        todo2_id = todo2_response.json()["id"]
        
        response = auth_client.put("/api/todos/reorder/", json.dumps({
            "items": [
                {"id": todo2_id, "order": 1},
                {"id": todo_id, "order": 2}
            ]
        }), content_type="application/json")
        assert response.status_code == 200
        
        todo2 = TodoItem.objects.get(id=todo2_id)
        assert todo2.order == 1
        
        # Delete
        response = auth_client.delete(f"/api/todos/{todo_id}/")
        assert response.status_code == 200
        assert TodoItem.objects.count() == 1
