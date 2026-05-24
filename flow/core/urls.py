from django.urls import path

from . import views
from .views import (
    get_7day_history, start_session, stop_session, session_hub,
    SessionHistoryListView, export_sessions_csv, export_sessions_pdf,
    get_current_session, pause_session, resume_session, rate_session,
    update_daily_goal, clear_all_history, update_dream_goal,
    get_todos, create_todo, update_todo, delete_todo, reorder_todos,
)

urlpatterns = [
    path("", views.profession_choice, name="profession_choice"),
    path("home/", views.home, name="home"),
    path("session-hub/", session_hub, name="session_hub"),
    path("session-history/", SessionHistoryListView.as_view(), name="session_history"),
    path("export/csv/", export_sessions_csv, name="export_csv"),
    path("export/pdf/", export_sessions_pdf, name="export_pdf"),
    path("api/session/current/", get_current_session, name="get_current_session"),
    path("api/session/start/", start_session, name="start_session"),
    path("api/session/pause/<int:session_id>/", pause_session, name="pause_session"),
    path("api/session/resume/<int:session_id>/", resume_session, name="resume_session"),
    path("api/session/stop/<int:session_id>/", stop_session, name="stop_session"),
    path("api/session/rate/<int:session_id>/", rate_session, name="rate_session"),
    path("api/history/7days/", get_7day_history, name="get_7day_history"),
    path("api/history/clear/", clear_all_history, name="clear_all_history"),
    path("api/goal/update/", update_daily_goal, name="update_daily_goal"),
    path("api/dream/update/", update_dream_goal, name="update_dream_goal"),
    path("api/todos/", get_todos, name="get_todos"),
    path("api/todos/create/", create_todo, name="create_todo"),
    path("api/todos/reorder/", reorder_todos, name="reorder_todos"),
    path("api/todos/<int:todo_id>/", delete_todo, name="delete_todo"),
    path("api/todos/<int:todo_id>/update/", update_todo, name="update_todo"),
]