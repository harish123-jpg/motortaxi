"""CSV exports (they reuse the same filters as the list pages)."""
from drivers.models import DriverProfile, DriverWallet, WalletTransaction
from rides.models import Ride
from users.models import User
from vehicles.models import Vehicle

from .. import services
from ..decorators import admin_required
from .customers import apply_user_filters
from .drivers import apply_driver_filters
from .helpers import csv_response
from .rides import apply_ride_filters
from .transactions import apply_txn_filters
from .vehicles import apply_vehicle_filters
from .wallets import apply_wallet_filters


@admin_required
def export_users_csv(request):
    qs = apply_user_filters(request, User.objects.filter(active_role="RIDER")).order_by("-date_joined")
    rows = [
        {"ID": u.pk, "Name": u.full_name, "Phone": u.phone_number, "Email": u.email or "",
         "City": u.city or "", "Date Joined": u.date_joined.strftime("%Y-%m-%d"),
         "Active": "Yes" if u.is_active else "No"}
        for u in qs.iterator()
    ]
    return csv_response("mototaxi-customers.csv", rows)


@admin_required
def export_drivers_csv(request):
    qs = apply_driver_filters(request, DriverProfile.objects.select_related("user")).order_by("-created_at")
    rows = [
        {"ID": d.pk, "Name": d.user.full_name, "Phone": d.user.phone_number,
         "License": d.license_number, "Status": d.status,
         "Verification": d.verification_status, "Rating": d.rating_avg, "Total Trips": d.total_trips}
        for d in qs
    ]
    return csv_response("mototaxi-drivers.csv", rows)


@admin_required
def export_rides_csv(request):
    qs = apply_ride_filters(request, Ride.objects.select_related("rider", "driver__user")).order_by("-created_at")
    rows = [
        {"ID": r.pk, "Customer": r.rider.full_name if r.rider else "",
         "Driver": r.driver.user.full_name if r.driver else "",
         "Pickup": r.pickup_address, "Drop": r.drop_address,
         "Distance (km)": r.distance_km, "Vehicle": r.vehicle_type,
         "Estimated Fare": r.estimated_fare, "Final Fare": r.final_fare or "",
         "Driver Payout": r.driver_payout or "", "Status": r.status,
         "Payment Status": r.payment_status, "Date": r.created_at.strftime("%Y-%m-%d %H:%M")}
        for r in qs
    ]
    return csv_response("mototaxi-rides.csv", rows)


@admin_required
def export_vehicles_csv(request):
    qs = apply_vehicle_filters(request, Vehicle.objects.select_related("driver__user")).order_by("-pk")
    rows = [
        {"ID": v.pk, "Type": v.vehicle_type, "Make": v.make, "Model": v.model,
         "Plate": v.plate_number, "Color": v.color,
         "Driver": v.driver.user.full_name if v.driver else "",
         "Active": "Yes" if v.is_active else "No"}
        for v in qs
    ]
    return csv_response("mototaxi-vehicles.csv", rows)


@admin_required
def export_wallets_csv(request):
    qs = apply_wallet_filters(request, DriverWallet.objects.select_related("driver__user")).order_by("-pk")
    rows = [
        {"ID": w.pk, "Driver": w.driver.user.full_name, "Phone": w.driver.user.phone_number,
         "Balance": w.balance, "Created At": w.created_at.strftime("%Y-%m-%d")}
        for w in qs
    ]
    return csv_response("mototaxi-wallets.csv", rows)


@admin_required
def export_transactions_csv(request):
    qs = apply_txn_filters(request, WalletTransaction.objects.select_related("wallet__driver__user"))
    rows = [
        {"ID": t.pk, "Driver": t.wallet.driver.user.full_name, "Type": t.transaction_type,
         "Reason": t.reason, "Amount": t.amount, "Balance After": t.balance_after,
         "Date": t.created_at.strftime("%Y-%m-%d %H:%M")}
        for t in qs.order_by("-created_at")
    ]
    return csv_response("mototaxi-transactions.csv", rows)


@admin_required
def export_commissions_csv(request):
    stats = services.driver_commission_map()  # 1 query for all drivers
    rows = []
    for d in DriverProfile.objects.select_related("user").order_by("pk"):
        bd = stats.get(d.pk) or services.empty_breakdown()
        rows.append({
            "ID": d.pk, "Driver": d.user.full_name, "Phone": d.user.phone_number,
            "Total Rides": bd["total_rides"], "Total Volume": bd["total_volume"],
            "Total Earned": bd["total_earned"], "Pending": bd["pending"],
            "Status": d.verification_status,
        })
    return csv_response("mototaxi-commissions.csv", rows)
