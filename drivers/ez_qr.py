import logging
from decimal import Decimal, InvalidOperation

import requests
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from rides.fare_estimate import CURRENCY
from rides.models import Ride

logger = logging.getLogger(__name__)


def ride_ref(ride_id):
    return f"ride:{ride_id}"


def parse_ride_ref(ref):
    ref = str(ref or "")
    if not ref.startswith("ride:"):
        return None
    try:
        return int(ref[5:])
    except ValueError:
        return None


def _post(path, payload, timeout):
    try:
        resp = requests.post(
            f"{settings.EZTRANSFER_URL}{path}",
            json=payload,
            headers={"X-Internal-Key": settings.EZTRANSFER_INTERNAL_KEY},
            timeout=timeout,
        )
    except requests.RequestException:
        return None, {}
    try:
        body = resp.json()
    except ValueError:
        body = {}
    return resp.status_code, body


def _group_send(group, payload):
    try:
        async_to_sync(get_channel_layer().group_send)(group, payload)
    except Exception:
        logger.exception("ws notify failed")


def _notify_paid(ride_id):
    ride = Ride.objects.select_related("driver__user").get(id=ride_id)
    event = {
        "type": "payment_received",
        "ride_id": ride.id,
        "amount": float(ride.final_fare or ride.estimated_fare),
        "currency": CURRENCY,
        "method": "EZTRANSFER",
    }
    if ride.driver_id:
        _group_send(f"driver_{ride.driver.user_id}", event)
    _group_send(f"rider_{ride.rider_id}", event)


def mark_ride_paid(ride_id, amount, transaction_id=None, invoice_no=None):
    with transaction.atomic():
        ride = Ride.objects.select_for_update().filter(id=ride_id).first()
        if ride is None:
            return "not_found"
        if ride.payment_status == Ride.PaymentStatus.PAID:
            return "already"
        if ride.status not in (Ride.Status.ONGOING, Ride.Status.COMPLETED):
            return "invalid_state"
        expected = ride.final_fare or ride.estimated_fare
        try:
            paid = Decimal(str(amount)).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError):
            return "invalid_amount"
        if paid != Decimal(str(expected)).quantize(Decimal("0.01")):
            return "amount_mismatch"

        details = dict(ride.payment_details or {})
        details.update({
            "provider": "eztransfer",
            "ref": ride_ref(ride.id),
            "transaction_id": transaction_id,
            "invoice_no": invoice_no,
            "paid_at": timezone.now().isoformat(),
        })
        ride.payment_status = Ride.PaymentStatus.PAID
        ride.payment_method = Ride.PaymentMethod.MOBILE_MONEY
        ride.payment_details = details
        ride.save(update_fields=["payment_status", "payment_method", "payment_details", "updated_at"])
        transaction.on_commit(lambda: _notify_paid(ride_id))
    return "paid"


def check_ride_paid(ride):
    status, body = _post("/qr/internal/fare-status/", {"ref": ride_ref(ride.id)}, 4)
    if status == 200 and body.get("paid"):
        return mark_ride_paid(
            ride.id, body.get("amount"), body.get("transaction_id"), body.get("invoice_no")
        )
    return "pending"


def get_fare_qr(ride):
    user = ride.driver.user
    if not user.is_phone_verified:
        return None, "Verify your phone number to receive payments."
    amount = Decimal(str(ride.final_fare or ride.estimated_fare))
    status, body = _post(
        "/qr/internal/fare-qr/",
        {
            "phone": user.phone_number,
            "amount": f"{amount:.2f}",
            "ref": ride_ref(ride.id),
            "expires_in_minutes": 180,
        },
        6,
    )
    if status is None:
        return None, "Payment service is unreachable. Try again."
    if status == 200:
        return body, None
    if status == 409 and body.get("paid"):
        mark_ride_paid(ride.id, body.get("amount"), body.get("transaction_id"), body.get("invoice_no"))
        return {"paid": True}, None
    if status == 404:
        return None, "No EzTransfer account found for your phone number."
    if status == 409:
        return None, "Your EzTransfer wallet is not available."
    return None, body.get("detail") or "Could not create the payment QR."


def send_fare_qr(ride):
    try:
        data, error = get_fare_qr(ride)
    except Exception:
        logger.exception("fare qr failed")
        data, error = None, "Could not create the payment QR."
    group = f"driver_{ride.driver.user_id}"
    if error:
        _group_send(group, {"type": "payment_qr_failed", "ride_id": ride.id, "detail": error})
    elif not data.get("paid"):
        _group_send(group, {
            "type": "payment_qr",
            "ride_id": ride.id,
            "currency": CURRENCY,
            "pickup_address": ride.pickup_address,
            "drop_address": ride.drop_address,
            **data,
        })


def cancel_fare_qr(ride):
    if (ride.payment_details or {}).get("provider") == "eztransfer":
        return
    status, body = _post("/qr/internal/fare-cancel/", {"ref": ride_ref(ride.id)}, 4)
    if status == 200 and body.get("paid"):
        logger.warning("ride %s: QR paid at the same time as completion", ride.id)


def resend_fare_qr(ride_id, driver_profile):
    ride = (
        Ride.objects.select_related("driver__user")
        .filter(id=ride_id, driver=driver_profile, status=Ride.Status.ONGOING)
        .first()
    )
    if ride is None or ride.payment_status != Ride.PaymentStatus.PENDING:
        return
    if check_ride_paid(ride) == "paid":
        return
    send_fare_qr(ride)


def get_pending_payment(driver_profile):
    ride = (
        Ride.objects.filter(
            driver=driver_profile,
            status=Ride.Status.ONGOING,
            payment_status=Ride.PaymentStatus.PENDING,
        )
        .order_by("-started_at")
        .first()
    )
    if not ride:
        return None
    return {
        "ride_id": ride.id,
        "amount": float(ride.estimated_fare),
        "currency": CURRENCY,
    }