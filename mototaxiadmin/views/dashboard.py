
from django.shortcuts import render

from drivers.models import WalletTransaction
from rides.models import Ride

from .. import services
from ..decorators import admin_required


def _money(value):
    return float(value or 0)


def _iso(value):
    return value.isoformat() if value else None


def _user_name(user):
    if not user:
        return "—"

    return (
        getattr(user, "full_name", None)
        or getattr(user, "username", None)
        or getattr(user, "phone_number", None)
        or "—"
    )


def _ride_status(value):
    labels = {
        "COMPLETED": "Completed",
        "CANCELLED": "Cancelled",
        "SEARCHING": "Searching",
        "ACCEPTED": "Accepted",
        "ONGOING": "Ongoing",
    }
    return labels.get(value, value or "Unknown")


def _payment_status(value):
    labels = {
        "PAID": "Successful",
        "PENDING": "Pending",
        "FAILED": "Failed",
    }
    return labels.get(value, value or "Unknown")


def _transaction_direction(value):
    # CREDIT adds money to the driver's wallet.
    # DEBIT removes money from the driver's wallet.
    return "Received" if value == "CREDIT" else "Sent"


@admin_required
def dashboard(request):
    stats = services.dashboard_stats()

    recent_rides = list(
        Ride.objects
        .select_related("rider", "driver__user")
        .order_by("-created_at")[:6]
    )

    recent_transactions = list(
        WalletTransaction.objects
        .select_related(
            "wallet__driver__user",
            "ride__rider",
            "ride__driver__user",
        )
        .order_by("-created_at")[:6]
    )

    # These are actual database records, formatted for the existing JS.
    recent_bookings = [
        {
            "id": ride.pk,
            "customer": _user_name(ride.rider),
            "driver": (
                _user_name(ride.driver.user)
                if ride.driver_id else "Unassigned"
            ),
            "pickup": ride.pickup_address or "—",
            "drop": ride.drop_address or "—",
            "vehicleType": (
                ride.vehicle_type.title()
                if ride.vehicle_type else "—"
            ),
            "total": _money(
                ride.final_fare
                if ride.final_fare is not None
                else ride.estimated_fare
            ),
            "status": _ride_status(ride.status),
        }
        for ride in recent_rides
    ]

    recent_txns = [
        {
            "id": txn.pk,
            "sender": (
                _user_name(txn.ride.rider)
                if txn.ride_id else "—"
            ),
            "receiver": _user_name(txn.wallet.driver.user),
            "direction": _transaction_direction(txn.transaction_type),
            "amount": _money(txn.amount),
            "type": (txn.reason or txn.transaction_type or "—").replace(
                "_", " "
            ).title(),
            "status": (
                _payment_status(txn.ride.payment_status)
                if txn.ride_id else "Recorded"
            ),
            "date": _iso(txn.created_at),
        }
        for txn in recent_transactions
    ]

    activity_feed = [
        {
            "kind": item["kind"],
            "title": item["title"],
            "desc": item["desc"],
            "time": _iso(item["time"]),
        }
        for item in services.activity_feed(6)
    ]

    dashboard_data = {
        "DASH_STATS": {
            "totalCustomers": stats["total_customers"],
            "activeDrivers": stats["active_drivers"],
            "ridesToday": stats["rides_today"],
            "revenueToday": _money(stats["revenue_today"]),
            "commissionToday": _money(stats["commission_today"]),
            "totalWalletBalance": _money(
                stats["total_wallet_balance"]
            ),
            "pendingTxns": stats["pending_txns"],
        },

        "DASHBOARD_TRENDS": services.revenue_trend(30),

        # Used by the vehicle chart.
        "VEHICLE_SPLIT": services.vehicle_split(),

        # Uses actual Ride.payment_status values.
        "TX_STATUS_SPLIT": services.tx_status_split(),

        # Includes driver labels and earnings.
        "AGENTS": services.top_drivers_by_commission(5),

        "RECENT_BOOKINGS": recent_bookings,
        "RECENT_TXNS": recent_txns,
        "ACTIVITY_FEED": activity_feed,
    }

    return render(
        request,
        "dashboard.html",
        {"dashboard_data": dashboard_data},
    )
