"""Wallet transactions."""
from django.db.models import Q
from django.shortcuts import get_object_or_404, render

from drivers.models import WalletTransaction

from .. import services
from ..decorators import admin_required
from .helpers import apply_date_range, paginate

_RELATED = ("wallet__driver__user", "ride__rider", "ride__driver__user")


def apply_txn_filters(request, qs):
    q = (request.GET.get("search") or "").strip()
    reason = request.GET.get("reason") or ""
    direction = request.GET.get("direction") or ""
    if q:
        qs = qs.filter(
            Q(wallet__driver__user__full_name__icontains=q)
            | Q(wallet__driver__license_number__icontains=q)
            | Q(ride__rider__full_name__icontains=q)
        )
    if reason:
        qs = qs.filter(reason=reason)
    if direction in ("CREDIT", "DEBIT"):
        qs = qs.filter(transaction_type=direction)
    return apply_date_range(qs, request)


def _filter_state(request):
    return {k: request.GET.get(k, "") for k in ("search", "reason", "direction", "date_from", "date_to")}


@admin_required
def transactions(request):
    qs = WalletTransaction.objects.select_related(*_RELATED)
    qs = apply_txn_filters(request, qs).order_by("-created_at")
    ctx = {
        "summary": services.transactions_summary(),
        "page_obj": paginate(request, qs, per_page=8),
        "filters": _filter_state(request),
    }
    return render(request, "transactions.html", ctx)


@admin_required
def transaction_detail(request, pk):
    txn = get_object_or_404(WalletTransaction.objects.select_related(*_RELATED), pk=pk)
    return render(request, "_partials/transaction_detail.html", {"txn": txn})
