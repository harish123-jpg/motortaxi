"""Fare pricing rules."""
from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.db import transaction
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from vehicles.models import VehiclePricing

from ..decorators import admin_required

VEHICLE_TYPES = ["BIKE", "CAR", "AUTO"]
MONEY_FIELDS = ["base_fare", "per_km_rate", "minimum_fare", "platform_commission_percent", "night_multiplier"]


@admin_required
def pricing(request):
    rules = {p.vehicle_type: p for p in VehiclePricing.objects.all()}
    return render(request, "pricing.html", {
        "bike": rules.get("BIKE"), "car": rules.get("CAR"), "auto": rules.get("AUTO"),
    })


def _parse_decimal(raw, label, errors, maximum=None):
    try:
        value = Decimal(raw)
    except InvalidOperation:
        errors.append(f"{label}: invalid number.")
        return None
    if not value.is_finite() or value < 0 or (maximum is not None and value > maximum):
        errors.append(f"{label}: value out of range.")
        return None
    return value


@require_POST
@admin_required
def pricing_save(request):
    errors, updates = [], {}

    for vtype in VEHICLE_TYPES:
        prefix = f"{vtype.lower()}_"
        values = {}
        for field in MONEY_FIELDS:
            raw = (request.POST.get(prefix + field) or "").strip()
            if raw:
                maximum = Decimal("100") if field == "platform_commission_percent" else None
                v = _parse_decimal(raw, f"{vtype} {field}", errors, maximum)
                if v is not None:
                    values[field] = v
        for field in ("night_start_hour", "night_end_hour"):
            raw = (request.POST.get(prefix + field) or "").strip()
            if raw:
                if raw.isdigit() and 0 <= int(raw) <= 23:
                    values[field] = int(raw)
                else:
                    errors.append(f"{vtype} {field}: must be 0-23.")
        values["night_pricing_enabled"] = request.POST.get(prefix + "night_pricing_enabled") == "on"
        updates[vtype] = values

    if errors:  # nothing is saved if anything is invalid
        for e in errors:
            messages.error(request, e)
        return redirect("mototaxiadmin:pricing")

    with transaction.atomic():  # all three vehicle types save together or not at all
        for vtype, values in updates.items():
            obj, _ = VehiclePricing.objects.get_or_create(vehicle_type=vtype)
            for k, v in values.items():
                setattr(obj, k, v)
            obj.is_active = True
            obj.save()

    messages.success(request, "Fare pricing rules updated successfully.")
    return redirect("mototaxiadmin:pricing")
