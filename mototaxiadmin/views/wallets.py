
"""Driver wallets admin page and manual wallet top-up."""

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q, Sum, Value, Prefetch
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST

from drivers.models import DriverWallet, WalletTransaction

from ..decorators import admin_required


def _wallet_queryset():
    return (
        DriverWallet.objects
        .select_related("driver__user")
        .annotate(
            credits_total=Coalesce(
                Sum(
                    "transactions__amount",
                    filter=Q(
                        transactions__transaction_type="CREDIT"
                    ),
                ),
                Value(Decimal("0.00")),
            ),
            debits_total=Coalesce(
                Sum(
                    "transactions__amount",
                    filter=Q(
                        transactions__transaction_type="DEBIT"
                    ),
                ),
                Value(Decimal("0.00")),
            ),
        )
        .prefetch_related(
            Prefetch(
                "transactions",
                queryset=WalletTransaction.objects.order_by(
                    "-created_at", "-pk"
                ),
            )
        )
        .order_by("-pk")
    )


def _owner_name(wallet):
    user = wallet.driver.user
    return (
        (getattr(user, "full_name", "") or "").strip()
        or user.get_full_name().strip()
        or user.username
    )


def _owner_phone(wallet):
    user = wallet.driver.user
    return (
        getattr(user, "phone_number", "")
        or getattr(user, "phone", "")
        or ""
    )


def _wallet_status(wallet):
    return (
        "Active"
        if wallet.driver.verification_status
        == wallet.driver.VerificationStatus.APPROVED
        else "Inactive"
    )


def _wallet_id(wallet):
    return f"WAL-{wallet.pk:04d}"


def _transaction_json(tx, wallet):
    return {
        "id": f"TXN-{tx.pk:06d}",
        "walletPk": wallet.pk,
        "walletId": _wallet_id(wallet),
        "type": tx.transaction_type,
        "reason": tx.get_reason_display(),
        "amount": str(tx.amount),
        "balanceAfter": str(tx.balance_after),
        "date": tx.created_at.isoformat() if tx.created_at else "",
        "rideId": tx.ride_id,
        "status": "Recorded",
    }


def _wallet_json(wallet):
    transactions = list(wallet.transactions.all())

    last_tx = transactions[0] if transactions else None

    return {
        "pk": wallet.pk,
        "id": _wallet_id(wallet),
        "owner": _owner_name(wallet),
        "type": "Driver",
        "phone": _owner_phone(wallet),
        "balance": str(wallet.balance),
        "credits": str(wallet.credits_total or Decimal("0.00")),
        "debits": str(wallet.debits_total or Decimal("0.00")),
        "status": _wallet_status(wallet),
        "lastTx": (
            last_tx.created_at.isoformat()
            if last_tx and last_tx.created_at
            else ""
        ),
        "driverId": wallet.driver_id,
    }


def apply_wallet_filters(request, queryset):
    search = (request.GET.get("search") or "").strip()
    status = (request.GET.get("status") or "").strip().lower()
    owner_type = (request.GET.get("owner_type") or "").strip()

    if search:
        query = (
            Q(driver__user__full_name__icontains=search)
            | Q(driver__user__username__icontains=search)
            | Q(driver__license_number__icontains=search)
        )

        if hasattr(
            queryset.model.driver.field.related_model.user.field.related_model,
            "phone_number",
        ):
            query |= Q(driver__user__phone_number__icontains=search)

        if search.isdigit():
            query |= Q(pk=int(search))

        queryset = queryset.filter(query)

    # This database currently supports driver wallets only.
    if owner_type and owner_type.lower() != "driver":
        return queryset.none()

    if status == "active":
        queryset = queryset.filter(
            driver__verification_status="APPROVED"
        )
    elif status == "inactive":
        queryset = queryset.exclude(
            driver__verification_status="APPROVED"
        )

    return queryset


def _filter_state(request):
    return {
        key: request.GET.get(key, "")
        for key in ("search", "owner_type", "status")
    }


@admin_required
def wallets(request):
    queryset = apply_wallet_filters(
        request,
        _wallet_queryset(),
    )

    # The existing page uses client-side search/filtering and pagination.
    # Serialize all matching wallets so the filters cover the full result.
    wallet_objects = list(queryset)

    wallets_data = []
    transactions_data = []

    for wallet in wallet_objects:
        wallets_data.append(_wallet_json(wallet))

        # The modal displays the latest eight transactions per wallet.
        for tx in list(wallet.transactions.all())[:8]:
            transactions_data.append(
                _transaction_json(tx, wallet)
            )

    context = {
        "wallets_json": wallets_data,
        "transactions_json": transactions_data,
        "filters": _filter_state(request),
    }

    return render(request, "wallets.html", context)


@admin_required
def wallet_detail(request, pk):
    wallet = get_object_or_404(
        _wallet_queryset(),
        pk=pk,
    )

    transactions = list(wallet.transactions.all()[:8])

    return render(
        request,
        "_partials/wallet_detail.html",
        {
            "wallet": wallet,
            "transactions": transactions,
            "credits": wallet.credits_total or Decimal("0.00"),
            "debits": wallet.debits_total or Decimal("0.00"),
        },
    )


@admin_required
@require_POST
def wallet_top_up(request):
    wallet_pk = (request.POST.get("wallet_pk") or "").strip()
    amount_raw = (request.POST.get("amount") or "").strip()

    if not wallet_pk.isdigit():
        return JsonResponse(
            {"ok": False, "message": "Select a valid wallet."},
            status=400,
        )

    try:
        amount = Decimal(amount_raw)
    except (InvalidOperation, TypeError, ValueError):
        return JsonResponse(
            {"ok": False, "message": "Enter a valid amount."},
            status=400,
        )

    if not amount.is_finite() or amount <= 0:
        return JsonResponse(
            {"ok": False, "message": "Amount must be greater than zero."},
            status=400,
        )

    if amount.as_tuple().exponent < -2:
        return JsonResponse(
            {"ok": False, "message": "Amount can have at most 2 decimal places."},
            status=400,
        )

    try:
        with transaction.atomic():
            wallet = get_object_or_404(
                DriverWallet.objects.select_for_update()
                .select_related("driver__user"),
                pk=int(wallet_pk),
            )

            if _wallet_status(wallet) != "Active":
                return JsonResponse(
                    {
                        "ok": False,
                        "message": (
                            "Only wallets belonging to approved drivers "
                            "can be topped up."
                        ),
                    },
                    status=400,
                )

            wallet.balance += amount
            wallet.save(update_fields=["balance", "updated_at"])

            tx = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type=WalletTransaction.TransactionType.CREDIT,
                reason=WalletTransaction.Reason.ADJUSTMENT,
                amount=amount,
                balance_after=wallet.balance,
            )

    except Exception:
        # Do not expose database/internal errors to the browser.
        raise

    return JsonResponse({
        "ok": True,
        "message": "Wallet credited and transaction recorded.",
        "wallet": {
            "pk": wallet.pk,
            "id": _wallet_id(wallet),
            "balance": str(wallet.balance),
            "status": _wallet_status(wallet),
        },
        "transaction": _transaction_json(tx, wallet),
    })
