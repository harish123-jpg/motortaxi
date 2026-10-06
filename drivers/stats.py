from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone

from .models import DriverProfile, DriverSession


def _online_seconds(driver: DriverProfile, window_start, window_end):
    """
    Sums the time the driver's status was ONLINE/BUSY/ON_TRIP (i.e. the
    session was open) during [window_start, window_end). A session that
    started before the window, or is still open (ended_at=None), is
    clipped to the window boundaries.
    """
    sessions = DriverSession.objects.filter(driver=driver, started_at__lt=window_end).filter(
        Q(ended_at__gt=window_start) | Q(ended_at__isnull=True)
    )

    now = timezone.now()
    total = timedelta()
    for session in sessions:
        s_start = max(session.started_at, window_start)
        s_end = min(session.ended_at or now, window_end)
        if s_end > s_start:
            total += s_end - s_start

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
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = now - timedelta(days=7)

    first_session = DriverSession.objects.filter(driver=driver).order_by("started_at").first()
    all_time_start = first_session.started_at if first_session else now

    return {
        "rating": float(driver.rating_avg),
        "today": _period_block(driver, start_of_today, now),
        "week": _period_block(driver, seven_days_ago, now),
        "all_time": _period_block(driver, all_time_start, now),
    }