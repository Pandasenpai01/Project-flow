from django.contrib import admin

from .models import DailyStatistic, Session, UserProfile


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("pk", "user", "status", "start_time", "end_time", "duration", "target_duration", "focus_quality")
    list_filter = ("status",)
    search_fields = ("user__username",)
    ordering = ("-start_time",)


@admin.register(DailyStatistic)
class DailyStatisticAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "total_focus_time", "daily_goal", "circular_progress")
    list_filter = ("date",)
    search_fields = ("user__username",)
    ordering = ("-date",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "dream_goal", "created_at")
    search_fields = ("user__username", "dream_goal")
    ordering = ("-created_at",)
    # Allow editing the dream_goal directly from the list view
    list_editable = ("dream_goal",)
