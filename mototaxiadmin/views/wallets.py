"""Driver wallets."""
from django.db.models import Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404, render

from drivers.models import DriverWallet, WalletTransaction

from .. import services
from ..decorators import admin_required
from .helpers import paginate


def apply_wallet_filters(request, qs):
    q = (request.GET.get("search") or "").strip()
    status = request.GET.get("status") or ""
    # NOTE: ?owner_type was read before but never used (only drivers have wallets), so removed.
    if q:
        qs = qs.filter(
            Q(driver__user__full_name__icontains=q) | Q(driver__user__phone_number__icontains=q)
            | Q(driver__license_number__icontains=q)
        )
    if status == "active":
        qs = qs.filter(driver__verification_status="APPROVED")
    elif status == "inactive":
        qs = qs.exclude(driver__verification_status="APPROVED")
    return qs


def _filter_state(request):
    return {k: request.GET.get(k, "") for k in ("search", "owner_type", "status")}


def _sum_by_type(kind):
    return Coalesce(
        Sum("transactions__amount", filter=Q(transactions__transaction_type=kind)),
        Value(services.ZERO), output_field=services.MONEY,
    )


@admin_required
def wallets(request):
    qs = DriverWallet.objects.select_related("driver__user").annotate(
        credits_total=_sum_by_type("CREDIT"), debits_total=_sum_by_type("DEBIT"),
    )
    qs = apply_wallet_filters(request, qs).order_by("-pk")
    page_obj = paginate(request, qs, per_page=8)

    # last transaction of every wallet on this page: 1 query (PostgreSQL DISTINCT ON)
    ids = [w.pk for w in page_obj.object_list]
    last = {
        t.wallet_id: t
        for t in WalletTransaction.objects.filter(wallet_id__in=ids)
        .order_by("wallet_id", "-created_at").distinct("wallet_id")
    }
    for w in page_obj.object_list:
        w._credits = w.credits_total
        w._debits = w.debits_total
        w._last_txn = last.get(w.pk)

    ctx = {
        "summary": services.wallets_summary(),
        "page_obj": page_obj,
        "filters": _filter_state(request),
    }
    return render(request, "wallets.html", ctx)


@admin_required
def wallet_detail(request, pk):
    wallet = get_object_or_404(DriverWallet.objects.select_related("driver__user"), pk=pk)
    totals = wallet.transactions.aggregate(
        credits=Sum("amount", filter=Q(transaction_type="CREDIT")),
        debits=Sum("amount", filter=Q(transaction_type="DEBIT")),
    )
    transactions = list(
        wallet.transactions.select_related("ride__rider", "ride__driver__user").order_by("-created_at")[:8]
    )
    ctx = {
        "wallet": wallet,
        "transactions": transactions,
        # real totals (before: only the 8 rows shown were added up)
        "credits": totals["credits"] or services.ZERO,
        "debits": totals["debits"] or services.ZERO,
    }
    return render(request, "_partials/wallet_detail.html", ctx)
