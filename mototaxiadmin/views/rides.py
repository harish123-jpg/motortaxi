
"""Rides / bookings management views."""

from django.db.models import Q
from django.shortcuts import get_object_or_404, render

from rides.models import Ride
from vehicles.models import VehiclePricing

from .. import services
from ..decorators import admin_required
from .helpers import apply_date_range, paginate


CAMEROON_CITIES = [
    "Douala",
    "Yaoundé",
    "Bafoussam",
    "Bamenda",
    "Garoua",
    "Maroua",
    "Ngaoundéré",
    "Bertoua",
    "Ebolowa",
    "Kribi",
    "Limbe",
]


def _get_attr(obj, names, default=None):
    """Safely read the first available field from a model instance."""
    for name in names:
        try:
            value = getattr(obj, name, None)
            if value is not None:
                return value
        except (AttributeError, TypeError):
            continue
    return default


def _city_for_ride(ride):
    """Infer the city from the saved pickup/drop addresses when possible."""
    addresses = " ".join([
        str(getattr(ride, "pickup_address", "") or ""),
        str(getattr(ride, "drop_address", "") or ""),
    ]).casefold()

    for city in CAMEROON_CITIES:
        if city.casefold() in addresses:
            return city

    return ""


def _status_label(value):
    value = str(value or "").upper()
    return {
        "SEARCHING": "Searching",
        "ACCEPTED": "Accepted",
        "ONGOING": "Ongoing",
        "COMPLETED": "Completed",
        "CANCELLED": "Cancelled",
    }.get(value, value.title() or "Unknown")


def _ride_to_json(ride, pricing_by_type):
    """Convert a Ride instance to the shape expected by rides.js."""
    rider = getattr(ride, "rider", None)
    driver_profile = getattr(ride, "driver", None)
    driver_user = getattr(driver_profile, "user", None) if driver_profile else None

    vehicle_type = str(getattr(ride, "vehicle_type", "") or "Unknown")
    pricing = pricing_by_type.get(vehicle_type)

    total = (
        _get_attr(ride, ("final_fare", "estimated_fare"), 0) or 0
    )
    estimated = getattr(ride, "estimated_fare", 0) or 0

    base = (
        _get_attr(ride, ("base_fare",), None)
        if getattr(ride, "base_fare", None) is not None
        else getattr(pricing, "base_fare", 0) if pricing else 0
    ) or 0

    payout = getattr(ride, "driver_payout", None)
    commission = max(float(total or 0) - float(payout or 0), 0) if payout is not None else 0

    distance = _get_attr(
        ride,
        ("distance_km", "distance", "total_distance_km"),
        0,
    ) or 0

    night_pricing = bool(
        _get_attr(ride, ("is_night_pricing", "night_pricing", "is_night"), False)
    )

    return {
        "id": str(ride.pk),
        "customer": (
            getattr(rider, "full_name", "")
            or getattr(rider, "username", "")
            or "—"
        ),
        "driver": (
            getattr(driver_user, "full_name", "")
            or getattr(driver_user, "username", "")
            or "—"
        ) if driver_user else "—",
        "pickup": str(getattr(ride, "pickup_address", "") or "—"),
        "drop": str(getattr(ride, "drop_address", "") or "—"),
        "city": _city_for_ride(ride),
        "distance": float(distance or 0),
        "vehicleType": vehicle_type.replace("_", " ").title(),
        "base": float(base or 0),
        "total": float(total or 0),
        "estimatedFare": float(estimated or 0),
        "commission": float(commission or 0),
        "payout": float(payout or 0),
        "night": night_pricing,
        "status": _status_label(ride.status),
        "paymentStatus": str(
            getattr(ride, "payment_status", "") or "Unknown"
        ).replace("_", " ").title(),
        "paymentMethod": str(
            getattr(ride, "payment_method", "") or "Unknown"
        ).replace("_", " ").title(),
        "date": (
            ride.created_at.isoformat()
            if getattr(ride, "created_at", None)
            else ""
        ),
        "detailUrl": f"/rides/{ride.pk}/detail/",
    }


def apply_ride_filters(request, queryset):
    """Apply the listing filters to the database queryset."""
    search = (request.GET.get("search") or "").strip()
    status = (request.GET.get("status") or "").strip().upper()
    vehicle_type = (request.GET.get("vehicle_type") or "").strip()
    city = (request.GET.get("city") or "").strip()

    if search:
        queryset = queryset.filter(
            Q(pk__icontains=search)
            | Q(rider__full_name__icontains=search)
            | Q(rider__username__icontains=search)
            | Q(driver__user__full_name__icontains=search)
            | Q(driver__user__username__icontains=search)
            | Q(pickup_address__icontains=search)
            | Q(drop_address__icontains=search)
        )

    if status:
        queryset = queryset.filter(status=status)

    if vehicle_type:
        queryset = queryset.filter(vehicle_type__iexact=vehicle_type)

    if city:
        queryset = queryset.filter(
            Q(pickup_address__icontains=city)
            | Q(drop_address__icontains=city)
        )

    return apply_date_range(queryset, request)


def _filter_state(request):
    return {
        key: request.GET.get(key, "")
        for key in (
            "search",
            "status",
            "vehicle_type",
            "city",
            "date_from",
            "date_to",
        )
    }


@admin_required
def rides(request):
    base_queryset = (
        Ride.objects
        .select_related("rider", "driver__user")
        .order_by("-created_at")
    )

    filtered_queryset = apply_ride_filters(request, base_queryset)

    # Fetch all records for the client-side search/filter controls.
    all_rides = list(base_queryset)

    pricing_by_type = {
        str(item.vehicle_type): item
        for item in VehiclePricing.objects.all()
    }

    rides_json = [
        _ride_to_json(ride, pricing_by_type)
        for ride in all_rides
    ]

    cities_json = sorted({
        item["city"]
        for item in rides_json
        if item["city"]
    })

    context = {
        "summary": services.rides_summary(),
        "page_obj": paginate(request, filtered_queryset, per_page=6),
        "filters": _filter_state(request),
        "rides_json": rides_json,
        "cities_json": cities_json,
    }

    return render(request, "rides.html", context)


@admin_required
def ride_detail(request, pk):
    ride = get_object_or_404(
        Ride.objects.select_related(
            "rider",
            "driver__user",
            "driver__wallet",
        ),
        pk=pk,
    )

    pricing = (
        VehiclePricing.objects
        .filter(vehicle_type=ride.vehicle_type)
        .order_by("-is_active")
        .first()
    )

    context = {
        "ride": ride,
        "base_fare": (
            getattr(ride, "base_fare", None)
            or (pricing.base_fare if pricing else None)
        ),
        "per_km_rate": pricing.per_km_rate if pricing else None,
    }

    return render(request, "_partials/ride_detail.html", context)
