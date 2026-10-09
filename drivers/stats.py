from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone

from .models import DriverProfile, DriverSession

SESSION_GRACE = timedelta(minutes=2)


def _session_end(session, now):
    if session.ended_at:
        return session.ended_at
    return min(now, session.last_seen_at + SESSION_GRACE)


def _online_seconds(driver: DriverProfile, window_start, window_end):
    sessions = DriverSession.objects.filter(
        driver=driver, started_at__lt=window_end
    ).filter(
        Q(ended_at__gt=window_start) | Q(ended_at__isnull=True)
    )

    now = timezone.now()
    intervals = []
    for session in sessions:
        s_start = max(session.started_at, window_start)
        s_end = min(_session_end(session, now), window_end)
        if s_end > s_start:
            intervals.append((s_start, s_end))

    intervals.sort()
    total = timedelta()
    cur_start = None
    cur_end = None
    for start, end in intervals:
        if cur_end is None or start > cur_end:
            if cur_end is not None:
                total += cur_end - cur_start
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    if cur_end is not None:
        total += cur_end - cur_start

    return total.total_seconds()


def _ride_stats(driver: DriverProfile, window_start, window_end):
    from rides.models import Ride

    agg = Ride.objects.filter(
        driver=driver,
        status=Ride.Status.COMPLETED,
        completed_at__gte=window_start,
        completed_at__lt=window_end,
    ).aggregate(total_rides=Count("id"), total_earnings=Sum("driver_payout"))

    return {
        "total_rides": agg["total_rides"] or 0,
        "total_earnings": float(agg["total_earnings"] or 0),
    }


def _period_block(driver: DriverProfile, window_start, window_end):
    online_seconds = _online_seconds(driver, window_start, window_end)
    ride_stats = _ride_stats(driver, window_start, window_end)
    return {
        "online_hours": round(online_seconds / 3600, 2),
        "total_rides": ride_stats["total_rides"],
        "total_earnings": ride_stats["total_earnings"],
    }


def get_driver_home_stats(driver: DriverProfile):
    now = timezone.now()
    start_of_today = timezone.localtime(now).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    seven_days_ago = now - timedelta(days=7)

    first_session = DriverSession.objects.filter(driver=driver).order_by("started_at").first()
    all_time_start = first_session.started_at if first_session else now

    return {
        "rating": float(driver.rating_avg),
        "today": _period_block(driver, start_of_today, now),
        "week": _period_block(driver, seven_days_ago, now),
        "all_time": _period_block(driver, all_time_start, now),
    }