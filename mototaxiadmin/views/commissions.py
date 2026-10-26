"""Commissions (per-driver breakdown)."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Q
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from drivers.models import DriverProfile
from vehicles.models import VehiclePricing

from .. import services
from ..decorators import admin_required
from .helpers import paginate


def _driver_rows(search=""):
    """All drivers + their totals using 2 queries total (was 4 queries per driver)."""
    qs = DriverProfile.objects.select_related("user", "wallet")
    if search:
        qs = qs.filter(
            Q(user__full_name__icontains=search) | Q(user__phone_number__icontains=search)
            | Q(license_number__icontains=search)
        )
    stats = services.driver_commission_map()
    rows = [{"driver": d, **(stats.get(d.pk) or services.empty_breakdown())} for d in qs]
    rows.sort(key=lambda r: r["total_earned"], reverse=True)
    return rows


def _filter_state(request):
    return {k: request.GET.get(k, "") for k in ("search", "city", "status")}


def _settlement_history(limit=6):
    """DEMO DATA: there is no settlement table yet. Replace with a real model before production."""
    stats = services.driver_commission_map()
    now = timezone.now()
    out = []
    drivers = DriverProfile.objects.select_related("user").order_by("pk")[:limit]
    for i, d in enumerate(drivers, start=1):
        earned = (stats.get(d.pk) or services.empty_breakdown())["total_earned"]
        out.append({
            "id": f"SETT-{i:03d}", "driver": d, "amount": earned / 4,
            "date": now - timedelta(days=i * 3), "status": "SUCCESSFUL",
        })
    return out


def _driver_settlements(driver):
    """DEMO DATA, see above."""
    now = timezone.now()
    return [
        {"id": f"SETT-{driver.pk}-{i:03d}", "amount": Decimal("5000") * i,
         "date": now - timedelta(days=i * 7), "status": "SUCCESSFUL"}
        for i in range(1, 5)
    ]


@admin_required
def commissions(request):
    filters = _filter_state(request)
    rows = _driver_rows(filters["search"].strip())
    ctx = {
        "summary": services.commissions_summary(),
        "page_obj": paginate(request, rows, per_page=6) if rows else None,
        "filters": filters,
        "pricing_rules": list(VehiclePricing.objects.all()),
        "settlements": _settlement_history(),
    }
    return render(request, "commissions.html", ctx)


@admin_required
def commission_detail(request, pk):
    driver = get_object_or_404(DriverProfile.objects.select_related("user", "wallet"), pk=pk)
    ctx = {
        "driver": driver,
        "breakdown": services.driver_commission_breakdown(driver),
        "settlements": _driver_settlements(driver),
    }
    return render(request, "_partials/commission_detail.html", ctx)
