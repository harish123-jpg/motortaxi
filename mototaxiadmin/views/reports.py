"""Reports."""
from datetime import datetime, time, timedelta

from django.shortcuts import render
from django.utils import timezone

from .. import services
from ..decorators import admin_required
from .helpers import safe_date


def _day_start(d):
    return timezone.make_aware(datetime.combine(d, time.min))


@admin_required
def reports(request):
    date_from = request.GET.get("date_from") or ""
    date_to = request.GET.get("date_to") or ""
    d_from, d_to = safe_date(date_from), safe_date(date_to)

    start = _day_start(d_from) if d_from else None
    end = _day_start(d_to + timedelta(days=1)) if d_to else None  # exclusive

    # the chart now follows the selected range (before: always the last 30 days)
    end_date = d_to or timezone.localdate()
    days = 30
    if d_from:
        days = max(1, min((end_date - d_from).days + 1, 366))

    trend = services.revenue_trend(days, end_date=end_date)
    ctx = {
        "stats": services.reports_stats(start=start, end=end),
        "trend": trend,
        "filters": {"date_from": date_from, "date_to": date_to},
        "revenue_series": [t["revenue"] for t in trend],
        "rides_series": [t["rides"] for t in trend],
        "trend_labels": [t["label"] for t in trend],
        "vehicle_revenue_split": services.vehicle_revenue_split(),
        "tx_status_split": services.tx_status_split(),
    }
    return render(request, "reports.html", ctx)
