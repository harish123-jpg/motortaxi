"""MOTOTAXI Admin: URL routing."""
from django.urls import path

from mototaxiadmin.views import (
    auth, commissions, customers, dashboard, drivers, exports,
    preferences, pricing, reports, rides, transactions, vehicles, wallets,
)

app_name = "mototaxiadmin"

urlpatterns = [
    # Auth
    path("login/", auth.login_view, name="login"),
    path("logout/", auth.logout_view, name="logout"),

    # Dashboard
    path("", dashboard.dashboard, name="dashboard"),
    # Customers
    path("users/", customers.users, name="users"),
    path("users/<int:pk>/detail/", customers.user_detail, name="user_detail"),
    path("users/<int:pk>/block/", customers.user_block, name="user_block"),

    # Drivers
    path("drivers/", drivers.drivers, name="drivers"),
    path(
        "drivers/<int:pk>/detail/",
        drivers.driver_detail,
        name="driver_detail",
    ),
    path(
        "drivers/<int:pk>/approve/",
        drivers.driver_approve,
        name="driver_approve",
    ),
    path(
        "drivers/<int:pk>/reject/",
        drivers.driver_reject,
        name="driver_reject",
    ),
    path(
        "drivers/<int:pk>/block/",
        drivers.driver_block,
        name="driver_block",
    ),

    # Rides
    path("rides/", rides.rides, name="rides"),
    path(
        "rides/<int:pk>/detail/",
        rides.ride_detail,
        name="ride_detail",
    ),

    # Vehicles
    path(
        "vehicles/",
        vehicles.vehicles,
        name="vehicles",
    ),
    path(
        "vehicles/<int:pk>/detail/",
        vehicles.vehicle_detail,
        name="vehicle_detail",
    ),
    path(
        "vehicles/add/",
        vehicles.vehicle_create,
        name="vehicle_create",
    ),
    path(
        "vehicles/<int:pk>/update/",
        vehicles.vehicle_update,
        name="vehicle_update",
    ),
    # Wallets
    path("wallets/", wallets.wallets, name="wallets"),
    path("wallets/<int:pk>/detail/", wallets.wallet_detail, name="wallet_detail"),

    # Transactions
    path("transactions/", transactions.transactions, name="transactions"),
    path("transactions/<int:pk>/detail/", transactions.transaction_detail, name="transaction_detail"),

    # Commissions
    path("commissions/", commissions.commissions, name="commissions"),
    path("commissions/<int:pk>/detail/", commissions.commission_detail, name="commission_detail"),

    # Pricing
    path("pricing/", pricing.pricing, name="pricing"),
    path("pricing/save/", pricing.pricing_save, name="pricing_save"),

    # Reports
    path("reports/", reports.reports, name="reports"),

    # Settings
    path("settings/", preferences.settings_view, name="settings"),
    path("settings/save/", preferences.settings_save, name="settings_save"),

    # CSV exports
    path("export/users.csv", exports.export_users_csv, name="export_users_csv"),
    path("export/drivers.csv", exports.export_drivers_csv, name="export_drivers_csv"),
    path("export/rides.csv", exports.export_rides_csv, name="export_rides_csv"),
    path("export/vehicles.csv", exports.export_vehicles_csv, name="export_vehicles_csv"),
    path("export/wallets.csv", exports.export_wallets_csv, name="export_wallets_csv"),
    path("export/transactions.csv", exports.export_transactions_csv, name="export_transactions_csv"),
    path("export/commissions.csv", exports.export_commissions_csv, name="export_commissions_csv"),
]
