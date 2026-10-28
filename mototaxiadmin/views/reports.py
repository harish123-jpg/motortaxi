"""Reports and analytics page backed by database data."""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.shortcuts import render
from django.utils import timezone

from rides.models import Ride
from .. import services
from ..decorators import admin_required
from .helpers import safe_date


def _day_start(day):
    """Return local midnight as an aware datetime."""
    value = datetime.combine(day, time.min)
    if timezone.is_aware(timezone.now()):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def _float(value):
    return float(value or Decimal("0"))


@admin_required
def reports(request):
    today = timezone.localdate()

    raw_from = (request.GET.get("date_from") or "").strip()
    raw_to = (request.GET.get("date_to") or "").strip()

    parsed_from = safe_date(raw_from) if raw_from else None
    parsed_to = safe_date(raw_to) if raw_to else None

    # Default: latest 30 calendar days, including today.
    date_to = parsed_to or today
    date_from = parsed_from or (date_to - timedelta(days=29))

    if date_from > date_to:
        date_from, date_to = date_to, date_from

    # Prevent extremely large report ranges.
    if (date_to - date_from).days > 365:
        date_from = date_to - timedelta(days=365)

    start = _day_start(date_from)
    end = _day_start(date_to + timedelta(days=1))

    range_qs = Ride.objects.filter(
        created_at__gte=start,
        created_at__lt=end,
    )

    days = (date_to - date_from).days + 1

    # Daily completed-ride revenue, commission, payouts and ride counts.
    trend = services.revenue_trend(
        days=days,
        end_date=date_to,
    )

    # Overall ride counts for the selected range.
    aggregate = range_qs.aggregate(
        total_rides=Count("pk"),
        completed_rides=Count(
            "pk",
            filter=Q(status="COMPLETED"),
        ),
        cancelled_rides=Count(
            "pk",
            filter=Q(status="CANCELLED"),
        ),
    )

    # Daily counts include cancellations and non-completed rides.
    daily = (
        range_qs
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(
            total_rides=Count("pk"),
            completed_rides=Count(
                "pk",
                filter=Q(status="COMPLETED"),
            ),
            cancellations=Count(
                "pk",
                filter=Q(status="CANCELLED"),
            ),
        )
        .order_by("day")
    )

    daily_by_date = {
        row["day"].isoformat(): row
        for row in daily
    }

    trend_by_date = {
        row["date"]: row
        for row in trend
    }

    table_rows = []

    for index in range(days):
        day = date_from + timedelta(days=index)
        iso = day.isoformat()

        trend_row = trend_by_date.get(iso, {})
        daily_row = daily_by_date.get(iso, {})

        revenue = _float(trend_row.get("revenue"))
        completed_count = int(trend_row.get("rides") or 0)

        table_rows.append({
            "date": iso,
            "label": day.strftime("%d %b, %Y"),
            "revenue": revenue,
            "rides": completed_count,
            "commission": _float(
                trend_row.get("commission")
            ),
            "payout": _float(
                trend_row.get("payout")
            ),
            "avgFare": (
                round(revenue / completed_count)
                if completed_count else 0
            ),
            "cancellations": int(
                daily_row.get("cancellations") or 0
            ),
        })

    # Vehicle revenue split for the selected range.
    fare_expr = Coalesce(
        "final_fare",
        "estimated_fare",
        Value(Decimal("0")),
        output_field=DecimalField(
            max_digits=14,
            decimal_places=2,
        ),
    )

    vehicle_rows = (
        range_qs
        .filter(status="COMPLETED")
        .order_by()
        .values("vehicle_type")
        .annotate(revenue=Sum(fare_expr))
    )

    vehicle_revenue = {
        row["vehicle_type"]: _float(row["revenue"])
        for row in vehicle_rows
    }

    # Payment status counts for the selected range.
    tx_rows = (
        range_qs
        .order_by()
        .values("payment_status")
        .annotate(count=Count("pk"))
    )

    tx_counts = {
        row["payment_status"]: row["count"]
        for row in tx_rows
    }

    total_count = int(aggregate["total_rides"] or 0)
    completed_count = int(aggregate["completed_rides"] or 0)
    cancelled_count = int(aggregate["cancelled_rides"] or 0)

    range_revenue = sum(
        row["revenue"] for row in trend
    )
    range_commission = sum(
        row["commission"] for row in trend
    )
    range_payout = sum(
        row["payout"] for row in trend
    )

    latest_day_revenue = (
        trend[-1]["revenue"] if trend else 0
    )

    stats = {
        "daily_revenue": latest_day_revenue,
        "range_revenue": range_revenue,
        "platform_commission": range_commission,
        "driver_payouts": range_payout,
        "completed_rides": completed_count,
        "total_rides": total_count,
        "cancelled_rides": cancelled_count,
        "cancellation_rate": (
            round(cancelled_count / total_count * 100, 1)
            if total_count else 0.0
        ),
    }

    payload = {
        "stats": stats,
        "trend": trend,
        "table_rows": table_rows,
        "vehicle_revenue_split": {
            "labels": ["Bike", "Car", "Auto"],
            "data": [
                vehicle_revenue.get(vehicle, 0)
                for vehicle in ("BIKE", "CAR", "AUTO")
            ],
        },
        "tx_status_split": {
            "labels": ["Successful", "Pending", "Failed"],
            "data": [
                tx_counts.get(status, 0)
                for status in ("PAID", "PENDING", "FAILED")
            ],
        },
    }

    context = {
        "reports_data_json": payload,
        "filters": {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
        },
    }

    return render(
        request,
        "reports.html",
        context,
    )