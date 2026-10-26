
"""Drivers management views for the MOTOTAXI admin panel."""

from django.contrib import messages
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from drivers.models import DriverProfile
from rides.models import Ride
from vehicles.models import Vehicle

from .. import services
from ..decorators import admin_required
from .helpers import paginate


def _first_attr(obj, names, default=""):
    """Return the first non-empty attribute from a list of possible names."""
    for name in names:
        try:
            value = getattr(obj, name, None)
            if value is not None and value != "":
                return value
        except (AttributeError, TypeError):
            continue
    return default


def _vehicle_type(vehicle):
    value = _first_attr(
        vehicle,
        ("vehicle_type", "type"),
        "Unknown",
    )
    return str(getattr(value, "label", value)).replace("_", " ").title()


def _vehicle_model(vehicle):
    return str(
        _first_attr(
            vehicle,
            ("vehicle_model", "model_name", "model", "name"),
            "—",
        )
    )


def _vehicle_plate(vehicle):
    return str(
        _first_attr(
            vehicle,
            ("plate_number", "registration_number", "registration_no", "plate"),
            "—",
        )
    )


def _approval_label(value):
    value = str(value or "").upper()
    labels = {
        "APPROVED": "Approved",
        "PENDING": "Pending",
        "REJECTED": "Rejected",
    }
    return labels.get(value, value.title() or "Pending")


def apply_driver_filters(request, queryset):
    """Apply search, vehicle, online and approval filters."""
    search = (request.GET.get("search") or "").strip()
    vehicle_type = (request.GET.get("vehicle_type") or "").strip()
    online = (request.GET.get("online") or "").strip().lower()
    approval = (request.GET.get("approval") or "").strip()

    if search:
        queryset = queryset.filter(
            Q(user__full_name__icontains=search)
            | Q(user__phone_number__icontains=search)
            | Q(license_number__icontains=search)
            | Q(user__username__icontains=search)
        )

    if vehicle_type and vehicle_type.lower() != "all":
        queryset = queryset.filter(
            vehicles__vehicle_type__iexact=vehicle_type,
            vehicles__is_active=True,
        ).distinct()

    if online == "online":
        queryset = queryset.filter(status__iexact="ONLINE")
    elif online == "offline":
        queryset = queryset.exclude(status__iexact="ONLINE")

    if approval and approval.lower() != "all":
        queryset = queryset.filter(
            verification_status__iexact=approval
        )

    return queryset


def _filter_state(request):
    return {
        key: request.GET.get(key, "")
        for key in ("search", "vehicle_type", "online", "approval")
    }


@admin_required
def drivers(request):
    """Render the drivers page with database-backed driver data."""
    base_queryset = (
        DriverProfile.objects
        .select_related("user", "wallet")
        .prefetch_related(
            # The related name "vehicles" is based on your existing view.
            # Only active vehicles are shown in the table.
            __import__("django.db.models", fromlist=["Prefetch"]).Prefetch(
                "vehicles",
                queryset=Vehicle.objects.filter(is_active=True),
                to_attr="active_vehicles",
            )
        )
        .order_by("-created_at")
    )

    filtered_queryset = apply_driver_filters(request, base_queryset)

    # Keep the page data and JSON data separate: client-side filtering
    # should be able to search the full driver list.
    all_drivers = list(base_queryset)
    driver_ids = [driver.pk for driver in all_drivers]

    # Aggregate completed rides and earnings in one query.
    ride_stats = {}
    if driver_ids:
        ride_stats = {
            row["driver_id"]: row
            for row in (
                Ride.objects
                .filter(
                    driver_id__in=driver_ids,
                    status="COMPLETED",
                )
                .values("driver_id")
                .annotate(
                    rides=Count("pk"),
                    earnings=Sum("driver_payout"),
                )
            )
        }

    # Get recent rides for the details modal.
    recent_rides = []
    if driver_ids:
        recent_rides = list(
            Ride.objects
            .filter(driver_id__in=driver_ids)
            .select_related("rider", "driver")
            .order_by("-created_at")[:300]
        )

    rides_json = []
    for ride in recent_rides:
        rides_json.append({
            "id": ride.pk,
            "driverId": ride.driver_id,
            "driver": (
                getattr(ride.driver.user, "full_name", "")
                if ride.driver_id and getattr(ride.driver, "user", None)
                else ""
            ),
            "customer": (
                getattr(ride.rider, "full_name", "")
                or getattr(ride.rider, "username", "—")
            ),
            "pickup": str(getattr(ride, "pickup_address", "") or "—"),
            "drop": str(getattr(ride, "dropoff_address", "") or "—"),
            "vehicleType": "—",
            "total": float(
                getattr(ride, "final_fare", None)
                or getattr(ride, "estimated_fare", None)
                or 0
            ),
            "status": str(ride.status).title(),
            "date": (
                ride.created_at.isoformat()
                if getattr(ride, "created_at", None)
                else ""
            ),
        })

    drivers_json = []

    for driver in all_drivers:
        user = driver.user
        active_vehicles = getattr(driver, "active_vehicles", [])
        vehicle = active_vehicles[0] if active_vehicles else None

        stats = ride_stats.get(driver.pk, {})
        online = (
            str(getattr(driver, "status", "")).upper() == "ONLINE"
            and user.is_active
        )

        rating = _first_attr(
            driver,
            ("rating", "average_rating", "average_rating_value"),
            0,
        )

        try:
            rating = float(rating or 0)
        except (TypeError, ValueError):
            rating = 0

        try:
            earnings = float(stats.get("earnings") or 0)
        except (TypeError, ValueError):
            earnings = 0

        # Optional status fields are only used if your model exposes them.
        license_status = _first_attr(
            driver,
            ("license_status",),
            "Unknown",
        )
        insurance_status = _first_attr(
            driver,
            ("insurance_status",),
            "Unknown",
        )

        drivers_json.append({
            "id": driver.pk,
            "name": (
                user.full_name
                or user.username
                or f"Driver {driver.pk}"
            ),
            "phone": user.phone_number or "—",
            "email": user.email or "",
            "vehicleType": _vehicle_type(vehicle) if vehicle else "Unknown",
            "vehicleModel": _vehicle_model(vehicle) if vehicle else "—",
            "plate": _vehicle_plate(vehicle) if vehicle else "—",
            "rating": rating,
            "rides": int(stats.get("rides") or 0),
            "earnings": earnings,
            "online": online,
            "approval": _approval_label(driver.verification_status),
            "license": str(license_status).title(),
            "insurance": str(insurance_status).title(),
            "verified": _approval_label(driver.verification_status),
            "isActive": bool(user.is_active),
            "detailUrl": reverse(
                "mototaxiadmin:driver_detail",
                args=[driver.pk],
            ),
            "approveUrl": reverse(
                "mototaxiadmin:driver_approve",
                args=[driver.pk],
            ),
            "rejectUrl": reverse(
                "mototaxiadmin:driver_reject",
                args=[driver.pk],
            ),
            "blockUrl": reverse(
                "mototaxiadmin:driver_block",
                args=[driver.pk],
            ),
        })

    page_obj = paginate(request, filtered_queryset, per_page=6)

    context = {
        "summary": services.drivers_summary(),
        "page_obj": page_obj,
        "filters": _filter_state(request),
        "drivers_json": drivers_json,
        "rides_json": rides_json,
    }

    return render(request, "drivers.html", context)


@admin_required
def driver_detail(request, pk):
    """Render the driver details partial."""
    driver = get_object_or_404(
        DriverProfile.objects.select_related("user", "wallet"),
        pk=pk,
    )

    active_vehicle = driver.vehicles.filter(is_active=True).first()

    recent_rides = (
        Ride.objects
        .filter(driver=driver)
        .select_related("rider")
        .order_by("-created_at")[:5]
    )

    return render(
        request,
        "_partials/driver_detail.html",
        {
            "driver": driver,
            "active_vehicle": active_vehicle,
            "recent_rides": recent_rides,
        },
    )


@require_POST
@admin_required
def driver_approve(request, pk):
    driver = get_object_or_404(
        DriverProfile.objects.select_related("user"),
        pk=pk,
    )

    driver.verification_status = "APPROVED"
    driver.save(update_fields=["verification_status", "updated_at"])

    messages.success(
        request,
        f"{driver.user.full_name or driver.user.username} has been approved.",
    )
    return redirect("mototaxiadmin:drivers")


@require_POST
@admin_required
def driver_reject(request, pk):
    driver = get_object_or_404(
        DriverProfile.objects.select_related("user"),
        pk=pk,
    )

    driver.verification_status = "REJECTED"
    driver.save(update_fields=["verification_status", "updated_at"])

    messages.warning(
        request,
        f"{driver.user.full_name or driver.user.username} has been rejected.",
    )
    return redirect("mototaxiadmin:drivers")


@require_POST
@admin_required
def driver_block(request, pk):
    driver = get_object_or_404(
        DriverProfile.objects.select_related("user"),
        pk=pk,
    )
    user = driver.user

    if user.pk == request.user.pk or user.is_superuser or user.is_staff:
        messages.error(
            request,
            "You cannot block yourself or another administrator.",
        )
        return redirect("mototaxiadmin:drivers")

    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])

    state = "unblocked" if user.is_active else "blocked"
    messages.success(
        request,
        f"{user.full_name or user.username} has been {state}.",
    )
    return redirect("mototaxiadmin:drivers")
