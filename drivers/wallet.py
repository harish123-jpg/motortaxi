from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from .models import DriverProfile, DriverWallet, WalletTransaction


def credit_ride_earning(driver_profile: DriverProfile, ride, amount):
    """
    Atomically credits a driver's wallet for a completed ride.
    select_for_update() locks the wallet row so two concurrent
    credits can't race and overwrite each other's balance.
    Caller (rides/trip.py complete_trip) wraps this in the SAME
    atomic() block as the ride-completion update.
    """
    wallet, _ = DriverWallet.objects.get_or_create(driver=driver_profile)
    wallet = DriverWallet.objects.select_for_update().get(pk=wallet.pk)

    wallet.balance = wallet.balance + amount
    wallet.save(update_fields=["balance", "updated_at"])

    WalletTransaction.objects.create(
        wallet=wallet,
        ride=ride,
        transaction_type=WalletTransaction.TransactionType.CREDIT,
        reason=WalletTransaction.Reason.RIDE_EARNING,
        amount=amount,
        balance_after=wallet.balance,
    )
    return wallet


def get_earnings_summary(driver_profile: DriverProfile):
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    wallet, _ = DriverWallet.objects.get_or_create(driver=driver_profile)

    credits = wallet.transactions.filter(
        transaction_type=WalletTransaction.TransactionType.CREDIT
    )

    def total_since(dt):
        return credits.filter(created_at__gte=dt).aggregate(total=Sum("amount"))["total"] or 0

    return {
        "current_balance": wallet.balance,
        "today_earnings": total_since(today_start),
        "week_earnings": total_since(week_start),
        "month_earnings": total_since(month_start),
    }