
"""Customer management views for the MotoTaxi admin panel."""

from django.contrib import messages
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from rides.models import Ride
from users.models import User

from .. import services
from ..decorators import admin_required
from .helpers import paginate


def _customer_wallet_balance(user):
    """
    Return a rider wallet balance if the rider profile exposes one.
    Returns 0 when no rider wallet balance is available.
    """
    try:
        profile = user.rider_profile
    except (AttributeError, User.rider_profile.RelatedObjectDoesNotExist):
        return 0

    for attr in ("wallet", "rider_wallet"):
        try:
            wallet = getattr(profile, attr, None)
            if wallet is not None and hasattr(wallet, "balance"):
                return float(wallet.balance or 0)
        except (AttributeError, TypeError, ValueError):
            continue

    for attr in ("wallet_balance", "balance"):
        try:
            value = getattr(profile, attr, None)
            if value is not None:
                return float(value or 0)
        except (AttributeError, TypeError, ValueError):
            continue

    return 0


def apply_user_filters(request, queryset):
    """Apply customer search and filters."""
    search = (request.GET.get("search") or "").strip()
    status = (request.GET.get("status") or "").lower()
    city = (request.GET.get("city") or "").strip()

    if search:
        queryset = queryset.filter(
            Q(full_name__icontains=search)
            | Q(phone_number__icontains=search)
            | Q(email__icontains=search)
            | Q(username__icontains=search)
        )

    if status == "active":
        queryset = queryset.filter(is_active=True)
    elif status == "blocked":
        queryset = queryset.filter(is_active=False)

    if city:
        queryset = queryset.filter(city__iexact=city)

    return queryset


def _filter_state(request):
    """Preserve selected filters in the template."""
    return {
        key: request.GET.get(key, "")
        for key in ("search", "status", "city")
    }


def _cities():
    """Return the available customer cities."""
    return list(
        User.objects.filter(active_role="RIDER")
        .exclude(city__isnull=True)
        .exclude(city__exact="")
        .values_list("city", flat=True)
        .distinct()
        .order_by("city")
    )


@admin_required
def users(request):
    """Customer listing page."""
    customer_queryset = User.objects.filter(
        active_role="RIDER"
    ).order_by("-date_joined")

    # Aggregate rides directly from the Ride model.
    # This does not depend on User's reverse related_name.
    ride_counts = dict(
        Ride.objects.filter(
            rider__active_role="RIDER"
        )
        .values("rider_id")
        .annotate(total=Count("pk"))
        .values_list("rider_id", "total")
    )

    filtered_queryset = apply_user_filters(
        request, customer_queryset
    )

    # Build the complete dataset for the existing frontend.
    # If your JavaScript filters the entire dataset client-side,
    # don't apply filters here before creating customers_json.
    customers = []

    for customer in customer_queryset.select_related("rider_profile"):
        customers.append({
            "id": customer.pk,
            "name": (
                customer.full_name
                or customer.username
                or "—"
            ),
            "phone": customer.phone_number or "—",
            "email": customer.email or "",
            "city": customer.city or "—",
            "regDate": (
                customer.date_joined.isoformat()
                if customer.date_joined else None
            ),
            "rides": ride_counts.get(customer.pk, 0),
            "wallet": _customer_wallet_balance(customer),
            "status": (
                "Active" if customer.is_active else "Blocked"
            ),
        })

    context = {
        "summary": services.customers_summary(),
        "page_obj": paginate(request, filtered_queryset, per_page=8),
        "filters": _filter_state(request),
        "cities": _cities(),
        "customers_json": customers,
        "cities_json": _cities(),
    }

    return render(request, "users.html", context)


@admin_required
def user_detail(request, pk):
    """Show a customer detail partial and recent rides."""
    customer = get_object_or_404(
        User.objects.filter(active_role="RIDER"),
        pk=pk,
    )

    recent_rides = (
        Ride.objects.filter(rider=customer)
        .select_related("driver__user")
        .order_by("-created_at")[:5]
    )

    context = {
        "user": customer,
        "customer": customer,
        "recent_rides": recent_rides,
    }

    return render(
        request,
        "_partials/user_detail.html",
        context,
    )


@require_POST
@admin_required
def user_block(request, pk):
    """Toggle a customer's active/blocked status."""
    customer = get_object_or_404(
        User.objects.filter(active_role="RIDER"),
        pk=pk,
    )

    if (
        customer.pk == request.user.pk
        or customer.is_superuser
        or customer.is_staff
    ):
        messages.error(
            request,
            "You cannot block yourself or an administrator.",
        )
        return redirect("mototaxiadmin:users")

    customer.is_active = not customer.is_active
    customer.save(update_fields=["is_active"])

    status = "unblocked" if customer.is_active else "blocked"

    messages.success(
        request,
        f"{customer.full_name or customer.username} has been {status}.",
    )

    return redirect("mototaxiadmin:users")
