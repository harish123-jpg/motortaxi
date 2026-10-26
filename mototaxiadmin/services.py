"""
MOTOTAXI Admin: aggregation helpers.

Every stat is computed inside the database (aggregate / group by),
never by looping over rows in Python.
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from drivers.models import DriverProfile, DriverWallet, WalletTransaction
from rides.models import Ride
from users.models import User
from vehicles.models import Vehicle

ZERO = Decimal("0")
MONEY = DecimalField(max_digits=14, decimal_places=2)

# fare = final_fare, else estimated_fare, else 0
FARE = Coalesce("final_fare", "estimated_fare", Value(ZERO), output_field=MONEY)
PAYOUT = Coalesce("driver_payout", Value(ZERO), output_field=MONEY)
COMMISSION = ExpressionWrapper(FARE - PAYOUT, output_field=MONEY)

IN_PROGRESS = ["ACCEPTED", "ONGOING"]
NOT_FINISHED = ["SEARCHING", "ACCEPTED", "ONGOING"]


# ---------- Time helpers (local timezone, not UTC) ----------
def today_start():
    return timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)


def last_n_days_start(n=30):
    return timezone.now() - timedelta(days=n)


def month_start():
    return timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)


# ---------- Money helpers (one SQL query each) ----------
def _sum(qs, expr):
    return qs.aggregate(t=Sum(expr))["t"] or ZERO


def sum_fares(qs):
    return _sum(qs, FARE)


def sum_payouts(qs):
    return _sum(qs, PAYOUT)


def sum_commissions(qs):
    return _sum(qs, COMMISSION)


# ---------- Dashboard ----------
def dashboard_stats():
    completed_today = Ride.objects.filter(created_at__gte=today_start(), status="COMPLETED")
    money = completed_today.aggregate(revenue=Sum(FARE), commission=Sum(COMMISSION))
    return {
        "total_customers": User.objects.filter(active_role="RIDER").count(),
        "active_drivers": DriverProfile.objects.filter(verification_status="APPROVED").count(),
        "rides_today": Ride.objects.filter(created_at__gte=today_start()).count(),
        "revenue_today": money["revenue"] or ZERO,
        "commission_today": money["commission"] or ZERO,
        "total_wallet_balance": DriverWallet.objects.aggregate(t=Sum("balance"))["t"] or ZERO,
        "pending_txns": Ride.objects.filter(payment_status="PENDING").count(),
    }


# ---------- Page summaries ----------
def customers_summary():
    qs = User.objects.filter(active_role="RIDER")
    a = qs.aggregate(
        total=Count("pk"),
        active=Count("pk", filter=Q(is_active=True)),
        blocked=Count("pk", filter=Q(is_active=False)),
        new_registrations=Count("pk", filter=Q(date_joined__gte=last_n_days_start(30))),
    )
    return a


def drivers_summary():
    return DriverProfile.objects.aggregate(
        total=Count("pk"),
        approved=Count("pk", filter=Q(verification_status="APPROVED")),
        pending=Count("pk", filter=Q(verification_status="PENDING")),
        online=Count("pk", filter=Q(status="ONLINE")),
        offline=Count("pk", filter=Q(status="OFFLINE")),
    )


def rides_summary():
    a = Ride.objects.aggregate(
        total=Count("pk"),
        completed=Count("pk", filter=Q(status="COMPLETED")),
        ongoing=Count("pk", filter=Q(status__in=IN_PROGRESS)),
        cancelled=Count("pk", filter=Q(status="CANCELLED")),
        total_fare_revenue=Sum(FARE, filter=Q(status="COMPLETED")),
    )
    a["total_fare_revenue"] = a["total_fare_revenue"] or ZERO
    return a


def vehicles_summary():
    return Vehicle.objects.aggregate(
        total=Count("pk"),
        bike=Count("pk", filter=Q(vehicle_type="BIKE")),
        car=Count("pk", filter=Q(vehicle_type="CAR")),
        active=Count("pk", filter=Q(is_active=True)),
    )


def wallets_summary():
    a = DriverWallet.objects.aggregate(
        total=Count("pk"),
        total_balance=Sum("balance"),
        active=Count("pk", filter=Q(driver__verification_status="APPROVED")),
    )
    a["total_balance"] = a["total_balance"] or ZERO
    a["inactive"] = a["total"] - a["active"]
    return a


def transactions_summary():
    txn = WalletTransaction.objects.aggregate(total=Count("pk"), volume=Sum("amount"))
    pay = Ride.objects.aggregate(
        pending=Count("pk", filter=Q(payment_status="PENDING")),
        failed=Count("pk", filter=Q(payment_status="FAILED")),
    )
    return {
        "total": txn["total"],
        "successful": txn["total"],  # WalletTransaction has no status: all are final
        "pending": pay["pending"],
        "failed": pay["failed"],
        "total_volume": txn["volume"] or ZERO,
    }


def commissions_summary():
    done = Ride.objects.filter(status="COMPLETED").aggregate(
        commission=Sum(COMMISSION), payouts=Sum(PAYOUT)
    )
    return {
        "total_platform_commission": done["commission"] or ZERO,
        "total_agent_commission": done["payouts"] or ZERO,
        "total_transfer_fees": ZERO,
        "pending_commissions": sum_payouts(Ride.objects.filter(status__in=NOT_FINISHED)),
    }


# ---------- Reports ----------
def reports_stats(start=None, end=None):
    """`end` is exclusive."""
    start = start or last_n_days_start(30)
    end = end or timezone.now()
    in_range = Ride.objects.filter(created_at__gte=start, created_at__lt=end)
    a = in_range.aggregate(
        total=Count("pk"),
        completed_rides=Count("pk", filter=Q(status="COMPLETED")),
        cancelled=Count("pk", filter=Q(status="CANCELLED")),
        commission=Sum(COMMISSION, filter=Q(status="COMPLETED")),
        payouts=Sum(PAYOUT, filter=Q(status="COMPLETED")),
    )
    done = Ride.objects.filter(status="COMPLETED")
    return {
        "daily_revenue": sum_fares(done.filter(created_at__gte=today_start())),
        "monthly_revenue": sum_fares(done.filter(created_at__gte=month_start())),
        "platform_commission": a["commission"] or ZERO,
        "driver_payouts": a["payouts"] or ZERO,
        "completed_rides": a["completed_rides"],
        "cancellation_rate": round(a["cancelled"] / a["total"] * 100, 1) if a["total"] else 0.0,
    }


def revenue_trend(days=30, end_date=None):
    """One grouped query for the whole period (was 4 queries x N days)."""
    end_date = end_date or timezone.localdate()
    first = end_date - timedelta(days=days - 1)
    rows = (
        Ride.objects.filter(status="COMPLETED", created_at__date__gte=first, created_at__date__lte=end_date)
        .annotate(day=TruncDate("created_at"))
        .order_by("day")
        .values("day")
        .annotate(
            revenue=Sum(FARE), commission=Sum(COMMISSION),
            payout=Sum(PAYOUT), rides=Count("pk"),
        )
    )
    by_day = {r["day"]: r for r in rows}
    out = []
    for i in range(days):
        d = first + timedelta(days=i)
        r = by_day.get(d)
        out.append({
            "date": d.isoformat(),
            "label": d.strftime("%d %b"),
            "revenue": float(r["revenue"] or 0) if r else 0.0,
            "rides": r["rides"] if r else 0,
            "commission": float(r["commission"] or 0) if r else 0.0,
            "payout": float(r["payout"] or 0) if r else 0.0,
        })
    return out


# ---------- Chart splits (one grouped query each) ----------
def vehicle_split():
    counts = dict(Ride.objects.order_by().values_list("vehicle_type").annotate(c=Count("pk")))
    return {"labels": ["Bike", "Car", "Auto"],
            "data": [counts.get("BIKE", 0), counts.get("CAR", 0), counts.get("AUTO", 0)]}


def vehicle_revenue_split():
    sums = dict(
        Ride.objects.filter(status="COMPLETED").order_by()
        .values_list("vehicle_type").annotate(s=Sum(FARE))
    )
    return {"labels": ["Bike", "Car", "Auto"],
            "data": [float(sums.get(k) or 0) for k in ("BIKE", "CAR", "AUTO")]}


def tx_status_split():
    counts = dict(Ride.objects.order_by().values_list("payment_status").annotate(c=Count("pk")))
    return {"labels": ["Successful", "Pending", "Failed"],
            "data": [counts.get("PAID", 0), counts.get("PENDING", 0), counts.get("FAILED", 0)]}


# ---------- Per-driver commission (ONE grouped query for all drivers) ----------
def empty_breakdown():
    return {"total_rides": 0, "total_volume": ZERO, "total_earned": ZERO, "pending": ZERO}


def driver_commission_map(driver_ids=None):
    """{driver_id: {total_rides, total_volume, total_earned, pending}}"""
    qs = Ride.objects.filter(driver__isnull=False, status__in=["COMPLETED"] + IN_PROGRESS)
    if driver_ids is not None:
        qs = qs.filter(driver_id__in=driver_ids)
    rows = (
        qs.order_by().values("driver_id")
        .annotate(
            total_rides=Count("pk", filter=Q(status="COMPLETED")),
            total_volume=Sum(FARE, filter=Q(status="COMPLETED")),
            total_earned=Sum(PAYOUT, filter=Q(status="COMPLETED")),
            pending=Sum(PAYOUT, filter=Q(status__in=IN_PROGRESS)),
        )
    )
    return {
        r["driver_id"]: {
            "total_rides": r["total_rides"],
            "total_volume": r["total_volume"] or ZERO,
            "total_earned": r["total_earned"] or ZERO,
            "pending": r["pending"] or ZERO,
        }
        for r in rows
    }


def driver_commission_breakdown(driver):
    return driver_commission_map([driver.pk]).get(driver.pk) or empty_breakdown()


def top_drivers_by_commission(limit=5):
    rows = (
        Ride.objects.filter(status="COMPLETED", driver__isnull=False).order_by()
        .values("driver_id", "driver__user__full_name")
        .annotate(earned=Sum(PAYOUT))
        .order_by("-earned")[:limit]
    )
    return [
        {"id": r["driver_id"], "label": r["driver__user__full_name"], "earned": float(r["earned"] or 0)}
        for r in rows
    ]


# ---------- Dashboard activity feed ----------
def activity_feed(limit=6):
    feed = []
    done = Ride.objects.filter(status="COMPLETED").select_related("rider", "driver__user").order_by("-completed_at")[:3]
    for r in done:
        feed.append({
            "kind": "green",
            "title": f"Ride #{r.pk} completed",
            "desc": f"{r.driver.user.full_name if r.driver else '—'} → {r.rider.full_name}",
            "time": r.completed_at or r.created_at,
        })
    pending = Ride.objects.filter(payment_status="PENDING").select_related("rider").order_by("-created_at")[:2]
    for r in pending:
        feed.append({
            "kind": "amber",
            "title": f"Ride #{r.pk} payment pending",
            "desc": f"Rider: {r.rider.full_name}",
            "time": r.created_at,
        })
    for d in DriverProfile.objects.select_related("user").order_by("-created_at")[:1]:
        feed.append({
            "kind": "blue",
            "title": "New driver registration",
            "desc": f"{d.user.full_name} — {d.verification_status}",
            "time": d.created_at,
        })
    feed.sort(key=lambda f: f.get("time") or timezone.now(), reverse=True)
    return feed[:limit]


# ---------- Avatar initials ----------
def initials(name):
    parts = [p for p in str(name or "").split() if p]
    return "".join(p[0].upper() for p in parts[:2]) or "?"
