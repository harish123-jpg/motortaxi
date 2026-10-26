
"""Vehicles admin page and JSON create/update endpoints."""

from django.db.models import Q, Prefetch
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from drivers.models import DriverProfile
from vehicles.models import Vehicle, VehicleDocument

from ..decorators import admin_required
from .helpers import paginate


def _driver_name(driver):
    user = getattr(driver, "user", None)

    if not user:
        return "Unassigned"

    full_name = (getattr(user, "full_name", "") or "").strip()

    if not full_name:
        full_name = user.get_full_name().strip()

    return full_name or getattr(user, "username", "") or str(user)


def _insurance_status(document):
    """Convert insurance document details into the UI status."""

    if not document:
        return "Pending"

    if (
        document.expiry_date
        and document.expiry_date < timezone.localdate()
    ):
        return "Expired"

    if (
        document.verification_status
        == VehicleDocument.VerificationStatus.VERIFIED
    ):
        return "Active"

    return "Pending"


def _verification_status(documents):
    if not documents:
        return "Pending"

    statuses = {doc.verification_status for doc in documents}

    if VehicleDocument.VerificationStatus.REJECTED in statuses:
        return "Rejected"

    if statuses == {
        VehicleDocument.VerificationStatus.VERIFIED
    }:
        return "Verified"

    return "Pending"


def _vehicle_to_json(vehicle):
    documents = list(vehicle.documents.all())

    insurance_doc = next(
        (
            doc
            for doc in documents
            if doc.document_type
            == VehicleDocument.DocumentType.INSURANCE
        ),
        None,
    )

    driver = vehicle.driver
    user = getattr(driver, "user", None)

    return {
        "pk": vehicle.pk,
        "id": f"VH-{vehicle.pk:04d}",
        "type": vehicle.get_vehicle_type_display(),
        "vehicleTypeValue": vehicle.vehicle_type,
        "make": vehicle.make,
        "modelName": vehicle.model,
        "model": f"{vehicle.make} {vehicle.model}".strip(),
        "reg": vehicle.plate_number,
        "color": vehicle.color,
        "driver": _driver_name(driver),
        "driverId": driver.pk,
        "driverPhone": (
            getattr(user, "phone_number", "")
            or getattr(user, "phone", "")
            or ""
        ),
        "insurance": _insurance_status(insurance_doc),
        "insuranceVerification": (
            insurance_doc.verification_status
            if insurance_doc
            else "MISSING"
        ),
        "insuranceExpiry": (
            insurance_doc.expiry_date.isoformat()
            if insurance_doc and insurance_doc.expiry_date
            else ""
        ),
        "verified": _verification_status(documents),
        "available": bool(vehicle.is_active),
        "createdAt": (
            vehicle.created_at.isoformat()
            if vehicle.created_at
            else ""
        ),
    }


def _vehicle_queryset():
    return (
        Vehicle.objects
        .select_related("driver__user")
        .prefetch_related(
            Prefetch(
                "documents",
                queryset=VehicleDocument.objects.all(),
            )
        )
        .order_by("-pk")
    )


def _filter_state(request):
    keys = (
        "search",
        "vehicle_type",
        "insurance",
        "verification",
        "availability",
    )

    return {
        key: request.GET.get(key, "")
        for key in keys
    }


def apply_vehicle_filters(request, qs):
    search = (request.GET.get("search") or "").strip()
    vehicle_type = (
        request.GET.get("vehicle_type") or ""
    ).strip()
    insurance = (
        request.GET.get("insurance") or ""
    ).strip().upper()
    verification = (
        request.GET.get("verification") or ""
    ).strip().upper()
    availability = (
        request.GET.get("availability") or ""
    ).strip().lower()

    if search:
        query = (
            Q(plate_number__icontains=search)
            | Q(make__icontains=search)
            | Q(model__icontains=search)
            | Q(driver__user__full_name__icontains=search)
            | Q(driver__user__username__icontains=search)
        )

        if search.isdigit():
            query |= Q(pk=int(search))

        qs = qs.filter(query)

    if vehicle_type:
        qs = qs.filter(vehicle_type=vehicle_type.upper())

    if availability in ("true", "available"):
        qs = qs.filter(is_active=True)
    elif availability in ("false", "unavailable"):
        qs = qs.filter(is_active=False)

    if insurance:
        qs = qs.filter(
            documents__document_type=(
                VehicleDocument.DocumentType.INSURANCE
            ),
            documents__verification_status=insurance,
        )

    if verification:
        qs = qs.filter(
            documents__verification_status=verification
        )

    if insurance or verification:
        qs = qs.distinct()

    return qs


@admin_required
def vehicles(request):
    all_vehicles = list(_vehicle_queryset())

    vehicles_data = [
        _vehicle_to_json(vehicle)
        for vehicle in all_vehicles
    ]

    drivers_data = []

    for driver in (
        DriverProfile.objects
        .select_related("user")
        .order_by("pk")
    ):
        drivers_data.append({
            "id": driver.pk,
            "name": _driver_name(driver),
        })

    filtered_qs = apply_vehicle_filters(
        request,
        _vehicle_queryset(),
    )

    context = {
        "page_obj": paginate(
            request,
            filtered_qs,
            per_page=8,
        ),
        "filters": _filter_state(request),
        "vehicles_json": vehicles_data,
        "drivers_json": drivers_data,
    }

    return render(request, "vehicles.html", context)


@admin_required
def vehicle_detail(request, pk):
    vehicle = get_object_or_404(
        _vehicle_queryset(),
        pk=pk,
    )

    return render(
        request,
        "_partials/vehicle_detail.html",
        {
            "vehicle": vehicle,
            "documents": list(vehicle.documents.all()),
        },
    )


def _error(message, status=400):
    return JsonResponse(
        {
            "ok": False,
            "message": message,
        },
        status=status,
    )


def _read_vehicle_payload(request):
    return {
        "vehicle_type": (
            request.POST.get("vehicle_type") or ""
        ).strip().upper(),
        "make": (
            request.POST.get("make") or ""
        ).strip(),
        "model": (
            request.POST.get("model") or ""
        ).strip(),
        "plate_number": (
            request.POST.get("plate_number") or ""
        ).strip().upper(),
        "color": (
            request.POST.get("color") or ""
        ).strip(),
        "driver_id": (
            request.POST.get("driver_id") or ""
        ).strip(),
        "is_active": (
            (request.POST.get("is_active") or "false")
            .lower()
            in ("1", "true", "yes", "on")
        ),
    }


def _validate_payload(data):
    valid_types = {
        choice[0]
        for choice in Vehicle.VehicleType.choices
    }

    if data["vehicle_type"] not in valid_types:
        return "Select a valid vehicle type."

    required_fields = (
        ("make", "Make"),
        ("model", "Model"),
        ("plate_number", "Registration number"),
        ("color", "Color"),
    )

    for field, label in required_fields:
        if not data[field]:
            return f"{label} is required."

    if not data["driver_id"].isdigit():
        return "Select an assigned driver."

    return None


def _save_vehicle_fields(vehicle, data):
    error = _validate_payload(data)

    if error:
        return error

    driver = DriverProfile.objects.filter(
        pk=int(data["driver_id"])
    ).first()

    if not driver:
        return "Selected driver was not found."

    duplicate_plate = (
        Vehicle.objects
        .filter(plate_number=data["plate_number"])
        .exclude(pk=vehicle.pk if vehicle.pk else None)
        .exists()
    )

    if duplicate_plate:
        return (
            "A vehicle with this registration number "
            "already exists."
        )

    vehicle.driver = driver
    vehicle.vehicle_type = data["vehicle_type"]
    vehicle.make = data["make"]
    vehicle.model = data["model"]
    vehicle.plate_number = data["plate_number"]
    vehicle.color = data["color"]
    vehicle.is_active = data["is_active"]

    vehicle.save()

    return None


@admin_required
@require_POST
def vehicle_create(request):
    data = _read_vehicle_payload(request)

    vehicle = Vehicle()

    error = _save_vehicle_fields(vehicle, data)

    if error:
        return _error(error)

    vehicle = _vehicle_queryset().get(pk=vehicle.pk)

    return JsonResponse(
        {
            "ok": True,
            "message": "Vehicle added successfully.",
            "vehicle": _vehicle_to_json(vehicle),
        },
        status=201,
    )


@admin_required
@require_POST
def vehicle_update(request, pk):
    vehicle = get_object_or_404(
        Vehicle,
        pk=pk,
    )

    data = _read_vehicle_payload(request)

    error = _save_vehicle_fields(vehicle, data)

    if error:
        return _error(error)

    vehicle = _vehicle_queryset().get(pk=vehicle.pk)

    return JsonResponse(
        {
            "ok": True,
            "message": "Vehicle updated successfully.",
            "vehicle": _vehicle_to_json(vehicle),
        }
    )
