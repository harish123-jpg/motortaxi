
"""Fare pricing configuration."""
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from vehicles.models import VehiclePricing

from ..decorators import admin_required


EDITABLE_VEHICLE_TYPES = ("BIKE", "CAR")

DECIMAL_FIELDS = {
    "base_fare": (Decimal("0"), None),
    "per_km_rate": (Decimal("0"), None),
    "minimum_fare": (Decimal("0"), None),
    "platform_commission_percent": (Decimal("0"), Decimal("100")),
    "night_multiplier": (Decimal("1"), Decimal("3")),
}


def _rule_json(rule):
    """Convert a pricing model to a JSON-safe representation."""
    return {
        "vehicle_type": rule.vehicle_type,
        "base_fare": str(rule.base_fare),
        "per_km_rate": str(rule.per_km_rate),
        "minimum_fare": str(rule.minimum_fare),
        "platform_commission_percent": str(
            rule.platform_commission_percent
        ),
        "night_multiplier": str(rule.night_multiplier),
        "night_pricing_enabled": rule.night_pricing_enabled,
        "night_start_hour": rule.night_start_hour,
        "night_end_hour": rule.night_end_hour,
        "is_active": rule.is_active,
    }


@admin_required
def pricing(request):
    rules = {
        rule.vehicle_type: rule
        for rule in VehiclePricing.objects.filter(
            vehicle_type__in=EDITABLE_VEHICLE_TYPES
        )
    }

    return render(request, "pricing.html", {
        "bike": rules.get("BIKE"),
        "car": rules.get("CAR"),
        "pricing_rules_json": [
            _rule_json(rule)
            for rule in rules.values()
        ],
        "pricing_save_url": "mototaxiadmin:pricing_save",
    })


def _parse_decimal(raw, label, errors, minimum, maximum=None):
    try:
        value = Decimal(raw)
    except (InvalidOperation, TypeError, ValueError):
        errors.append(f"{label}: enter a valid number.")
        return None

    if not value.is_finite():
        errors.append(f"{label}: enter a finite number.")
        return None

    if value < minimum:
        errors.append(f"{label}: minimum value is {minimum}.")
        return None

    if maximum is not None and value > maximum:
        errors.append(f"{label}: maximum value is {maximum}.")
        return None

    return value


@require_POST
@admin_required
def pricing_save(request):
    selected_types = request.POST.getlist("vehicle_types")

    # Accept a single value as well as repeated vehicle_types parameters.
    if len(selected_types) == 1 and "," in selected_types[0]:
        selected_types = [
            value.strip().upper()
            for value in selected_types[0].split(",")
            if value.strip()
        ]

    selected_types = list(dict.fromkeys(
        value.upper() for value in selected_types
    ))

    if not selected_types:
        return JsonResponse({
            "success": False,
            "errors": ["Select at least one vehicle type to save."],
        }, status=400)

    invalid_types = [
        value for value in selected_types
        if value not in EDITABLE_VEHICLE_TYPES
    ]
    if invalid_types:
        return JsonResponse({
            "success": False,
            "errors": ["Unsupported vehicle type selected."],
        }, status=400)

    errors = []
    updates = {}

    for vehicle_type in selected_types:
        prefix = vehicle_type.lower() + "_"
        values = {}

        for field, (minimum, maximum) in DECIMAL_FIELDS.items():
            raw = (request.POST.get(prefix + field) or "").strip()

            if not raw:
                errors.append(
                    f"{vehicle_type}: {field.replace('_', ' ')} is required."
                )
                continue

            parsed = _parse_decimal(
                raw,
                f"{vehicle_type} {field.replace('_', ' ')}",
                errors,
                minimum,
                maximum,
            )
            if parsed is not None:
                values[field] = parsed

        for field in ("night_start_hour", "night_end_hour"):
            raw = (
                request.POST.get(prefix + field) or ""
            ).strip()

            if not raw.isdigit() or not 0 <= int(raw) <= 23:
                errors.append(
                    f"{vehicle_type}: {field.replace('_', ' ')} "
                    "must be an hour between 0 and 23."
                )
            else:
                values[field] = int(raw)

        values["night_pricing_enabled"] = (
            request.POST.get(prefix + "night_pricing_enabled") == "on"
        )

        updates[vehicle_type] = values

    if errors:
        return JsonResponse({
            "success": False,
            "errors": errors,
        }, status=400)

    try:
        # Save all selected types together or save none if an error occurs.
        from django.db import transaction

        with transaction.atomic():
            for vehicle_type, values in updates.items():
                rule, _ = VehiclePricing.objects.get_or_create(
                    vehicle_type=vehicle_type
                )

                for field, value in values.items():
                    setattr(rule, field, value)

                rule.is_active = True
                rule.save()

    except Exception:
        # Log the underlying exception server-side in production.
        return JsonResponse({
            "success": False,
            "errors": [
                "Could not save pricing rules. Check the server logs."
            ],
        }, status=500)

    saved_rules = {
        rule.vehicle_type: _rule_json(rule)
        for rule in VehiclePricing.objects.filter(
            vehicle_type__in=selected_types
        )
    }

    return JsonResponse({
        "success": True,
        "message": "Pricing rules saved successfully.",
        "rules": saved_rules,
    })
