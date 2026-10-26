
"""Driver commission management."""
from decimal import Decimal

from django.db.models import Q
from django.shortcuts import get_object_or_404, render

from drivers.models import DriverProfile
from vehicles.models import VehiclePricing

from .. import services
from ..decorators import admin_required
from .helpers import paginate


def _driver_rows(search=""):
    """Return drivers with their existing commission breakdowns."""
    queryset = DriverProfile.objects.select_related("user", "wallet")

    if search:
        query = (
            Q(user__full_name__icontains=search)
            | Q(user__username__icontains=search)
            | Q(user__phone_number__icontains=search)
            | Q(license_number__icontains=search)
        )
        if search.isdigit():
            query |= Q(pk=int(search))
        queryset = queryset.filter(query)

    commission_map = services.driver_commission_map()
    rows = []

    for driver in queryset:
        breakdown = (
            commission_map.get(driver.pk)
            or services.empty_breakdown()
        )

        rows.append({
            "driver": driver,
            "breakdown": breakdown,
        })

    rows.sort(
        key=lambda row: Decimal(
            str(row["breakdown"].get("total_earned") or 0)
        ),
        reverse=True,
    )
    return rows


def _filter_state(request):
    return {
        key: request.GET.get(key, "")
        for key in ("search", "city", "status")
    }


def _driver_name(driver):
    user = driver.user
    return (
        getattr(user, "full_name", "")
        or user.get_full_name()
        or getattr(user, "username", "")
        or f"Driver {driver.pk}"
    ).strip()


def _first_value(data, *keys, default=0):
    """Read the first available field from a commission breakdown."""
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return default


def _driver_json(row):
    driver = row["driver"]
    breakdown = row["breakdown"]
    user = driver.user

    location = getattr(driver, "current_location", "") or ""
    wallet = getattr(driver, "wallet", None)

    return {
        "pk": driver.pk,
        "id": f"DRV-{driver.pk:04d}",
        "name": _driver_name(driver),
        "phone": getattr(user, "phone_number", "") or "—",
        "location": str(location) or "—",
        "status": driver.get_status_display(),
        "verificationStatus": driver.get_verification_status_display(),
        "licenseNumber": driver.license_number or "—",
        "trips": _first_value(
            breakdown, "total_trips", "total_transactions", "trips"
        ),
        "volume": str(_first_value(
            breakdown, "total_fare", "total_volume", "total_ride_volume"
        )),
        "earned": str(_first_value(
            breakdown, "total_earned", "commission_earned"
        )),
        # There is no settlement model, so pending is intentionally unknown.
        "pending": None,
        "walletBalance": str(wallet.balance) if wallet else None,
    }


@admin_required
def commissions(request):
    filters = _filter_state(request)
    rows = _driver_rows(filters["search"].strip())

    pricing_rules = list(
        VehiclePricing.objects.all().order_by("vehicle_type", "pk")
    )

    page_obj = paginate(request, rows, per_page=6) if rows else None

    context = {
        "page_obj": page_obj,
        "filters": filters,
        "drivers_json": [_driver_json(row) for row in rows],
        "pricing_rules_json": [
            {
                "vehicleType": pricing.get_vehicle_type_display(),
                "baseFare": str(pricing.base_fare),
                "perKmRate": str(pricing.per_km_rate),
                "minimumFare": str(pricing.minimum_fare),
                "platformCommissionPercent": str(
                    pricing.platform_commission_percent
                ),
            }
            for pricing in pricing_rules
        ],
    }
    return render(request, "commissions.html", context)


@admin_required
def commission_detail(request, pk):
    driver = get_object_or_404(
        DriverProfile.objects.select_related("user", "wallet"),
        pk=pk,
    )

    breakdown = services.driver_commission_breakdown(driver)

    context = {
        "driver": driver,
        "breakdown": breakdown,
        # Settlement history is not available until a real model exists.
        "settlements": [],
    }
    return render(
        request,
        "_partials/commission_detail.html",
        context,
    )
