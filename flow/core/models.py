from django.conf import settings
from django.db import models


class Session(models.Model):
    """A timed work session belonging to a user."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        PAUSED = "paused", "Paused"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="flow_sessions",
        verbose_name="user",
        help_text="The user this session belongs to.",
    )
    start_time = models.DateTimeField(
        verbose_name="start time",
        help_text="When the session began.",
    )
    end_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="end time",
        help_text="When the session ended (set when completed).",
    )
    duration = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="duration",
        help_text="Session length in seconds (set when completed).",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="status",
        help_text="Whether the session is active, paused, or completed.",
    )
    target_duration = models.PositiveIntegerField(
        default=1500,
        verbose_name="target duration",
        help_text="The user's chosen session goal in seconds (e.g. 1500 for 25 min).",
    )
    focus_quality = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="focus quality",
        help_text="User rating indicating session quality (e.g. 1-5).",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="created at",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="updated at",
    )

    class Meta:
        verbose_name = "session"
        verbose_name_plural = "sessions"
        ordering = ["-start_time"]

    def __str__(self) -> str:
        return f"Session {self.pk} ({self.status})"


class DailyStatistic(models.Model):
    """Aggregated focus time for a user on a single calendar day."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_statistics",
        verbose_name="user",
        help_text="The user this daily aggregate belongs to.",
    )
    date = models.DateField(
        verbose_name="date",
        help_text="The calendar day this row summarizes.",
    )
    total_focus_time = models.IntegerField(
        default=0,
        verbose_name="total focus time",
        help_text="Total focus time in seconds (sum of completed sessions that day).",
    )
    sessions = models.ManyToManyField(
        Session,
        blank=True,
        related_name="daily_statistics",
        verbose_name="sessions",
        help_text="Completed sessions counted toward this day (optional link for queries).",
    )
    circular_progress = models.FloatField(
        default=0.0,
        verbose_name="circular progress",
        help_text="Percentage of daily goal achieved (0–100); updated by views later.",
    )
    daily_goal = models.PositiveIntegerField(
        default=120,
        verbose_name="daily goal (minutes)",
        help_text="The user's focus-time goal for this day, in minutes.",
    )

    @property
    def progress_percentage(self):
        """Return focus completion as 0–100, based on total_focus_time (seconds) vs daily_goal (minutes)."""
        if not self.daily_goal:
            return 0.0
        focus_minutes = (self.total_focus_time or 0) / 60.0
        return min(round(focus_minutes / self.daily_goal * 100, 1), 100.0)
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="created at",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="updated at",
    )

    class Meta:
        verbose_name = "daily statistic"
        verbose_name_plural = "daily statistics"
        ordering = ["-date"]
        unique_together = [["user", "date"]]

    def __str__(self) -> str:
        return f"{self.user_id} @ {self.date}"
