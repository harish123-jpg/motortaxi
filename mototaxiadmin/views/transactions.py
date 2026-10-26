
"""Wallet transactions."""

from django.db.models import Q
from django.shortcuts import get_object_or_404, render

from drivers.models import WalletTransaction

from ..decorators import admin_required
from .helpers import apply_date_range


_RELATED = (
    "wallet__driver__user",
    "ride__rider",
    "ride__driver__user",
)


def _owner_name(user):
    if not user:
        return "Unknown"

    return (
        (getattr(user, "full_name", "") or "").strip()
        or user.get_full_name().strip()
        or getattr(user, "username", "")
        or "Unknown"
    )


def _transaction_id(txn):
    return f"TXN-{txn.pk:06d}"


def _reason_label(txn):
    return txn.get_reason_display()


def _transaction_json(txn):
    wallet = txn.wallet
    driver = wallet.driver
    user = driver.user

    is_credit = txn.transaction_type == "CREDIT"
    reason = txn.reason

    # These are display labels derived from the existing model.
    # Invoice number, fee and payment status are not stored.
    if reason == "RIDE_EARNING":
        sender = "MOTOTAXI"
        receiver = _owner_name(user) if is_credit else "MOTOTAXI"
    elif reason == "WITHDRAWAL":
        sender = _owner_name(user) if not is_credit else "MOTOTAXI"
        receiver = "MOTOTAXI" if not is_credit else _owner_name(user)
    else:
        sender = "MOTOTAXI" if is_credit else _owner_name(user)
        receiver = _owner_name(user) if is_credit else "MOTOTAXI"

    return {
        "pk": txn.pk,
        "id": _transaction_id(txn),
        "invoice": "—",
        "walletId": f"WAL-{wallet.pk:04d}",
        "walletPk": wallet.pk,
        "driver": _owner_name(user),
        "licenseNumber": driver.license_number,
        "sender": sender,
        "receiver": receiver,
        "direction": "Received" if is_credit else "Sent",
        "transactionType": txn.transaction_type,
        "reason": reason,
        "type": _reason_label(txn),
        "amount": str(txn.amount),
        "fee": None,
        "total": str(txn.amount),
        "balanceAfter": str(txn.balance_after),
        "status": "Recorded",
        "date": txn.created_at.isoformat() if txn.created_at else "",
        "rideId": txn.ride_id,
    }


def apply_txn_filters(request, queryset):
    search = (request.GET.get("search") or "").strip()
    reason = (request.GET.get("reason") or "").strip()
    direction = (request.GET.get("direction") or "").strip().upper()

    if search:
        search_query = (
            Q(wallet__driver__user__full_name__icontains=search)
            | Q(wallet__driver__user__username__icontains=search)
            | Q(wallet__driver__license_number__icontains=search)
        )

        if search.isdigit():
            search_query |= Q(pk=int(search)) | Q(wallet_id=int(search))

        queryset = queryset.filter(search_query)

    if reason in {
        WalletTransaction.Reason.RIDE_EARNING,
        WalletTransaction.Reason.ADJUSTMENT,
        WalletTransaction.Reason.WITHDRAWAL,
    }:
        queryset = queryset.filter(reason=reason)

    if direction in {
        WalletTransaction.TransactionType.CREDIT,
        WalletTransaction.TransactionType.DEBIT,
    }:
        queryset = queryset.filter(transaction_type=direction)

    return apply_date_range(queryset, request)


def _filter_state(request):
    return {
        key: request.GET.get(key, "")
        for key in (
            "search",
            "reason",
            "direction",
            "date_from",
            "date_to",
        )
    }


@admin_required
def transactions(request):
    queryset = (
        WalletTransaction.objects
        .select_related(*_RELATED)
        .order_by("-created_at", "-pk")
    )
    queryset = apply_txn_filters(request, queryset)

    # The existing JavaScript filters and paginates client-side.
    # Pass the matching database rows, not demo transactions.
    transaction_rows = [
        _transaction_json(txn)
        for txn in queryset
    ]

    context = {
        "transactions_json": transaction_rows,
        "filters": _filter_state(request),
    }

    return render(request, "transactions.html", context)


@admin_required
def transaction_detail(request, pk):
    txn = get_object_or_404(
        WalletTransaction.objects.select_related(*_RELATED),
        pk=pk,
    )

    return render(
        request,
        "_partials/transaction_detail.html",
        {"txn": txn},
    )
