import json
import csv
from datetime import timedelta

from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.db.models import Sum, Avg, Max
from django.views.generic import ListView
from django.contrib.auth.mixins import LoginRequiredMixin

from .models import DailyStatistic, Session


def home(request):
    return render(request, "home.html")


def profession_choice(request):
    return render(request, "profession_choice.html")


@require_http_methods(["GET"])
def session_hub(request):
    return render(
        request,
        "session_hub.html",
        {
            "user": request.user,
            "is_authenticated": request.user.is_authenticated,
        },
    )


def _get_elapsed_seconds(session):
    now = timezone.now()
    start = session.start_time
    if not start:
        return 0
    if timezone.is_aware(now) and timezone.is_naive(start):
        start = timezone.make_aware(start)
    elif timezone.is_naive(now) and timezone.is_aware(start):
        now = timezone.make_aware(now)
    return int(max(0, (now - start).total_seconds()))

def _get_json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


@require_http_methods(["POST"])
def start_session(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "authentication_required"},
            status=401,
        )

    body = _get_json_body(request)
    if body is None:
        return JsonResponse({"error": "invalid_json"}, status=400)

    raw_target = body.get("target_duration") if isinstance(body, dict) else None
    try:
        target_duration = int(raw_target) if raw_target is not None else 1500
        if target_duration <= 0:
            target_duration = 1500
    except (TypeError, ValueError):
        target_duration = 1500

    try:
        session = Session.objects.create(
            user=request.user,
            start_time=timezone.now(),
            status=Session.Status.ACTIVE,
            target_duration=target_duration,
            end_time=None,
            duration=None,
        )
    except Exception:
        return JsonResponse({"error": "could_not_start_session"}, status=500)

    return JsonResponse(
        {
            "session_id": session.pk,
            "start_time": session.start_time.isoformat(),
            "status": session.status,
            "target_duration": session.target_duration,
        },
        status=201,
    )


@require_http_methods(["POST"])
def stop_session(request, session_id=None):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "authentication_required"},
            status=401,
        )

    body = _get_json_body(request)
    if body is None:
        return JsonResponse({"error": "invalid_json"}, status=400)

    raw_session_id = session_id or (body.get("session_id") if isinstance(body, dict) else None) or request.POST.get(
        "session_id"
    )
    if not raw_session_id:
        return JsonResponse({"error": "session_id_required"}, status=400)

    try:
        raw_session_id = int(raw_session_id)
    except (TypeError, ValueError):
        return JsonResponse({"error": "session_id_must_be_int"}, status=400)

    try:
        session = Session.objects.get(pk=raw_session_id, user=request.user)
    except Session.DoesNotExist:
        return JsonResponse({"error": "session_not_found"}, status=404)
    except Exception:
        return JsonResponse({"error": "could_not_fetch_session"}, status=500)

    if session.status == Session.Status.COMPLETED or session.end_time is not None:
        return JsonResponse(
            {
                "error": "session_already_stopped",
                "session_id": session.pk,
                "end_time": session.end_time.isoformat() if session.end_time else None,
                "duration": session.duration,
                "status": session.status,
            },
            status=409,
        )

    end_time = timezone.now()
    
    if session.status == Session.Status.PAUSED:
        duration_seconds = session.duration or 0
    else:
        duration_seconds = _get_elapsed_seconds(session)

    session.end_time = end_time
    session.duration = duration_seconds
    session.status = Session.Status.COMPLETED

    try:
        session.save(update_fields=["end_time", "duration", "status", "updated_at"])
    except Exception:
        return JsonResponse({"error": "could_not_stop_session"}, status=500)

    return JsonResponse(
        {
            "session_id": session.pk,
            "end_time": session.end_time.isoformat(),
            "duration": session.duration,
            "status": session.status,
        }
    )


@require_http_methods(["GET"])
def get_current_session(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "authentication_required"},
            status=401,
        )

    try:
        session = Session.objects.filter(
            user=request.user, 
            status__in=[Session.Status.ACTIVE, Session.Status.PAUSED]
        ).order_by('-start_time').first()
        
        if not session:
            return JsonResponse({"active": False})
            
        if session.status == Session.Status.PAUSED:
            # For paused sessions, the saved duration is authoritative.
            elapsed = session.duration or 0
        else:
            # Both now() and start_time are UTC-aware; subtraction is safe.
            now_utc = timezone.now()
            start_utc = session.start_time
            elapsed = int(max(0, (now_utc - start_utc).total_seconds()))
        
        return JsonResponse({
            "active": True,
            "status": session.status,
            "session_id": session.pk,
            "elapsed_seconds": elapsed,
            "start_time": session.start_time.isoformat(),
            "target_duration": session.target_duration,
        })
    except Exception:
        return JsonResponse({"error": "could_not_fetch_session"}, status=500)


@require_http_methods(["POST"])
def pause_session(request, session_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
        
    try:
        session = Session.objects.get(pk=session_id, user=request.user, status=Session.Status.ACTIVE)
    except Session.DoesNotExist:
        return JsonResponse({"error": "active_session_not_found"}, status=404)
        
    session.duration = _get_elapsed_seconds(session)
    session.status = Session.Status.PAUSED
    session.save(update_fields=["duration", "status", "updated_at"])
    
    return JsonResponse({
        "session_id": session.pk,
        "status": session.status,
        "duration": session.duration,
        "target_duration": session.target_duration,
    })


@require_http_methods(["POST"])
def rate_session(request, session_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
        
    rating = request.POST.get("rating")
    if not rating:
        body = _get_json_body(request)
        if isinstance(body, dict):
            rating = body.get("rating")

    try:
        rating = int(rating)
        if not (1 <= rating <= 5):
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid_rating", "message": "Rating must be an integer between 1 and 5."}, status=400)

    try:
        session = Session.objects.get(pk=session_id, user=request.user)
    except Session.DoesNotExist:
        return JsonResponse({"error": "session_not_found"}, status=404)
        
    session.focus_quality = rating
    session.save(update_fields=["focus_quality", "updated_at"])
    
    return JsonResponse({
        "session_id": session.pk,
        "focus_quality": session.focus_quality
    })


@require_http_methods(["POST"])
def resume_session(request, session_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
        
    try:
        session = Session.objects.get(pk=session_id, user=request.user, status=Session.Status.PAUSED)
    except Session.DoesNotExist:
        return JsonResponse({"error": "paused_session_not_found"}, status=404)
        
    now = timezone.now()
    recovered_start_time = now - timedelta(seconds=session.duration or 0)
    
    session.start_time = recovered_start_time
    session.status = Session.Status.ACTIVE
    session.save(update_fields=["start_time", "status", "updated_at"])
    
    return JsonResponse({
        "session_id": session.pk,
        "status": session.status,
        "start_time": session.start_time.isoformat(),
        "duration": session.duration
    })


@require_http_methods(["GET"])
def get_7day_history(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "authentication_required"},
            status=401,
        )

    today = timezone.now().date()
    start_date = today - timedelta(days=6)

    try:
        stats_qs = DailyStatistic.objects.filter(
            user=request.user,
            date__gte=start_date,
            date__lte=today,
        )
        stats_by_date = {row.date: row for row in stats_qs}
    except Exception:
        return JsonResponse({"error": "could_not_fetch_history"}, status=500)

    data = []
    for i in range(7):
        day = start_date + timedelta(days=i)
        stat = stats_by_date.get(day)

        if stat is None:
            try:
                stat, _created = DailyStatistic.objects.get_or_create(
                    user=request.user,
                    date=day,
                    defaults={"total_focus_time": 0, "circular_progress": 0.0},
                )
            except Exception:
                return JsonResponse({"error": "could_not_create_missing_day"}, status=500)

        data.append(
            {
                "date": stat.date.isoformat(),
                "total_focus_time": stat.total_focus_time,
                "circular_progress": float(stat.circular_progress),
            }
        )

    return JsonResponse({"data": data})


class SessionHistoryListView(LoginRequiredMixin, ListView):
    model = Session
    template_name = "session_history.html"
    context_object_name = "sessions"
    paginate_by = 10

    def get_queryset(self):
        qs = super().get_queryset().filter(user=self.request.user).order_by("-start_time")
        
        # Filtering by date range
        start_date = self.request.GET.get('start_date')
        end_date = self.request.GET.get('end_date')
        if start_date:
            qs = qs.filter(start_time__date__gte=start_date)
        if end_date:
            qs = qs.filter(start_time__date__lte=end_date)
            
        # Filtering by status    
        status = self.request.GET.get('status')
        if status:
            qs = qs.filter(status=status)
            
        return qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        base_qs = Session.objects.filter(user=self.request.user)
        completed_qs = base_qs.filter(status=Session.Status.COMPLETED)
        
        # Analytics
        context['total_sessions'] = completed_qs.count()
        total_seconds = completed_qs.aggregate(Sum('duration'))['duration__sum'] or 0
        context['total_focus_hours'] = round(total_seconds / 3600.0, 1)
        
        avg_seconds = completed_qs.aggregate(Avg('duration'))['duration__avg'] or 0
        context['avg_session_minutes'] = round(avg_seconds / 60)
        
        max_seconds = completed_qs.aggregate(Max('duration'))['duration__max'] or 0
        context['longest_session_minutes'] = round(max_seconds / 60)
        
        # Current streak logic
        stats = DailyStatistic.objects.filter(user=self.request.user, total_focus_time__gt=0).order_by('-date')
        streak = 0
        today = timezone.now().date()
        current_date = today
        
        if stats.exists():
            first_stat_date = stats.first().date
            if first_stat_date == today or first_stat_date == today - timedelta(days=1):
                current_date = first_stat_date
                for stat in stats:
                    if stat.date == current_date:
                        streak += 1
                        current_date -= timedelta(days=1)
                    elif stat.date > current_date:
                        continue
                    else:
                        break
        
        context['current_streak'] = streak
        
        # Pass filters back to context
        context['current_filters'] = {
            'start_date': self.request.GET.get('start_date', ''),
            'end_date': self.request.GET.get('end_date', ''),
            'status': self.request.GET.get('status', '')
        }
        
        return context

@require_http_methods(["GET"])
def export_sessions_csv(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
        
    response = HttpResponse(content_type='text/csv')
    filename = f"sessions_export_{timezone.now().date().isoformat()}.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(['Date', 'Duration (min)', 'Status', 'Focus Quality'])

    sessions = Session.objects.filter(user=request.user, status=Session.Status.COMPLETED).order_by('-start_time')
    for session in sessions:
        duration_mins = round(session.duration / 60) if session.duration else 0
        writer.writerow([
            session.start_time.strftime("%Y-%m-%d %H:%M"),
            duration_mins,
            session.get_status_display(),
            session.focus_quality if session.focus_quality is not None else "N/A"
        ])

    return response

@require_http_methods(["GET"])
def export_sessions_pdf(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    
    try:
        from reportlab.pdfgen import canvas
    except ImportError:
        return JsonResponse({"error": "reportlab not installed"}, status=500)
        
    response = HttpResponse(content_type='application/pdf')
    filename = f"sessions_export_{timezone.now().date().isoformat()}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    sessions = Session.objects.filter(user=request.user, status=Session.Status.COMPLETED).order_by('-start_time')
    total_sessions = sessions.count()
    
    total_seconds = sessions.aggregate(duration_sum=Sum('duration'))['duration_sum'] or 0
    total_hours = round(total_seconds / 3600.0, 1)

    p = canvas.Canvas(response)
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, 800, f"Session History Report - {request.user.username}")
    
    p.setFont("Helvetica", 12)
    p.drawString(50, 780, f"Date Range Report (As of: {timezone.now().date().isoformat()})")
    
    # Analytics
    p.drawString(50, 750, f"Total Completed Sessions: {total_sessions}")
    p.drawString(50, 730, f"Total Focus Time: {total_hours} hours")
    
    # Table Header
    y = 690
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y, "Date & Time")
    p.drawString(200, y, "Duration (min)")
    p.drawString(320, y, "Status")
    p.drawString(420, y, "Focus")
    
    p.line(50, y - 5, 520, y - 5)
    
    y -= 25
    p.setFont("Helvetica", 11)
    
    for session in sessions:
        if y < 50:
            p.showPage()
            y = 800
            p.setFont("Helvetica", 11)
            
        duration_mins = round(session.duration / 60) if session.duration else 0
        quality_str = f"{session.focus_quality}/5" if session.focus_quality is not None else "N/A"
        
        p.drawString(50, y, session.start_time.strftime("%Y-%m-%d %H:%M"))
        p.drawString(200, y, str(duration_mins))
        p.drawString(320, y, session.get_status_display())
        p.drawString(420, y, quality_str)
        
        y -= 20
        
    p.showPage()
    p.save()
    return response

