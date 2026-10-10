import json

from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.core import signing
from django.utils import timezone

from .fare_estimate import CURRENCY
from .models import Ride

QR_SALT = "demo-ride-qr"
QR_MAX_AGE_SECONDS = 60 * 60 * 6

DEMO_CARD = {
    "number": "4242424242424242",
    "name": "JOHN DOE",
    "expiry": "12/28",
    "cvv": "123",
}


# ---------------------------------------------------------------------
# DEMO PAYMENT: core logic (sync, DB wala)
# ---------------------------------------------------------------------
def make_qr_payload(ride):
    return signing.dumps(
        {"ride_id": ride.id, "driver_id": ride.driver_id},
        salt=QR_SALT,
    )


def is_valid_qr(ride, payload):
    if not payload:
        return False
    try:
        data = signing.loads(str(payload), salt=QR_SALT, max_age=QR_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return False
    return data.get("ride_id") == ride.id and data.get("driver_id") == ride.driver_id


def validate_demo_card(data):
    number = "".join(ch for ch in str(data.get("card_number", "")) if ch.isdigit())
    name = " ".join(str(data.get("card_name", "")).upper().split())
    expiry = str(data.get("expiry", "")).strip()
    cvv = str(data.get("cvv", "")).strip()

    if number != DEMO_CARD["number"]:
        return "Invalid card number."
    if name != DEMO_CARD["name"]:
        return "Invalid cardholder name."
    if expiry != DEMO_CARD["expiry"]:
        return "Invalid expiry date."
    if cvv != DEMO_CARD["cvv"]:
        return "Invalid CVV."
    return None


def demo_payment_block_reason(ride):
    """
    trip.complete_trip se call hota hai.
    Non-cash ride mein payment nahi hui to complete roko.
    """
    if (
        ride.payment_method != Ride.PaymentMethod.CASH
        and ride.payment_status != Ride.PaymentStatus.PAID
    ):
        return "Rider has not paid yet."
    return None


def get_payment_info(ride_id, user):
    ride = Ride.objects.select_related("driver__user", "rider").filter(id=ride_id).first()
    if ride is None:
        return {"success": False, "detail": "Ride not found."}

    is_rider = ride.rider_id == user.id
    is_driver = ride.driver_id is not None and ride.driver.user_id == user.id
    if not (is_rider or is_driver):
        return {"success": False, "detail": "Ride not found."}

    if ride.driver_id is None:
        return {"success": False, "detail": "Driver not assigned yet."}

    data = {
        "ride_id": ride.id,
        "amount": float(ride.estimated_fare),
        "currency": CURRENCY,
        "ride_status": ride.status,
        "payment_method": ride.payment_method,
        "payment_status": ride.payment_status,
        "driver_name": ride.driver.user.full_name,
        "driver_phone": ride.driver.user.phone_number,
        "rider_phone": ride.rider.phone_number,
        "demo_card": {
            "number": "4242 4242 4242 4242",
            "name": DEMO_CARD["name"],
            "expiry": DEMO_CARD["expiry"],
            "cvv": DEMO_CARD["cvv"],
        },
        "can_complete": (
            ride.status == Ride.Status.ONGOING
            and (
                ride.payment_method == Ride.PaymentMethod.CASH
                or ride.payment_status == Ride.PaymentStatus.PAID
            )
        ),
    }

    if is_driver:
        data["qr_payload"] = make_qr_payload(ride)
        data["rider_number"] = (ride.payment_details or {}).get("rider_number")

    return {"success": True, "data": data}


def pay_ride(ride_id, rider_user, method, data):
    ride = Ride.objects.select_related("driver__user").filter(id=ride_id, rider=rider_user).first()
    if ride is None:
        return {"success": False, "detail": "Ride not found.", "paid": False}

    if ride.status != Ride.Status.ONGOING:
        return {
            "success": False,
            "detail": "Payment is allowed only during an ongoing trip.",
            "paid": False,
        }

    if ride.payment_status == Ride.PaymentStatus.PAID:
        return {"success": False, "detail": "Already paid.", "paid": False}

    if method not in (
        Ride.PaymentMethod.CASH,
        Ride.PaymentMethod.CARD,
        Ride.PaymentMethod.UPI,
        Ride.PaymentMethod.MOBILE_MONEY,
    ):
        return {"success": False, "detail": "Invalid payment method.", "paid": False}

    details = {}

    if method == Ride.PaymentMethod.CASH:
        Ride.objects.filter(id=ride.id).update(
            payment_method=method,
            payment_details={},
        )
        return {
            "success": True,
            "detail": "Cash selected. Pay the driver directly.",
            "paid": False,
        }

    if method == Ride.PaymentMethod.CARD:
        error = validate_demo_card(data)
        if error:
            return {"success": False, "detail": error, "paid": False}
        details = {"card_last4": DEMO_CARD["number"][-4:]}

    elif method == Ride.PaymentMethod.UPI:
        if not is_valid_qr(ride, data.get("qr_payload")):
            return {
                "success": False,
                "detail": "Invalid QR code. Scan the driver's QR.",
                "paid": False,
            }
        details = {"scanned": True}

    elif method == Ride.PaymentMethod.MOBILE_MONEY:
        rider_number = str(data.get("rider_number", "")).strip()
        if not rider_number:
            return {"success": False, "detail": "rider_number is required.", "paid": False}
        details = {
            "rider_number": rider_number,
            "amount": str(data.get("amount") or ride.estimated_fare),
            "driver_number": ride.driver.user.phone_number,
        }

    details["paid_at"] = timezone.now().isoformat()

    updated = Ride.objects.filter(
        id=ride.id,
        status=Ride.Status.ONGOING,
        payment_status=Ride.PaymentStatus.PENDING,
    ).update(
        payment_method=method,
        payment_status=Ride.PaymentStatus.PAID,
        payment_details=details,
    )
    if updated == 0:
        return {
            "success": False,
            "detail": "Payment state changed, please retry.",
            "paid": False,
        }

    try:
        async_to_sync(get_channel_layer().group_send)(
            f"driver_{ride.driver.user_id}",
            {
                "type": "payment_received",
                "ride_id": ride.id,
                "method": method,
                "amount": float(ride.estimated_fare),
                "rider_number": details.get("rider_number"),
            },
        )
    except Exception:
        pass

    return {"success": True, "detail": "Payment successful.", "paid": True}


# ---------------------------------------------------------------------
# DEMO PAYMENT: WebSocket mixins (consumers inhe inherit karte hain)
# ---------------------------------------------------------------------
class _DemoPaymentCommonMixin:
    async def _demo_send(self, payload):
        await self.send(text_data=json.dumps(payload))

    async def demo_handle_get_payment_info(self, data):
        ride_id = data.get("ride_id")
        if ride_id is None:
            await self._demo_send({"type": "error", "detail": "ride_id is required."})
            return

        try:
            result = await self._demo_run_payment_info(ride_id)
        except Exception:
            result = {"success": False, "detail": "Something went wrong."}

        if result["success"]:
            await self._demo_send({"type": "payment_info", **result["data"]})
        else:
            await self._demo_send({
                "type": "payment_info_failed",
                "ride_id": ride_id,
                "detail": result["detail"],
            })

    @database_sync_to_async
    def _demo_run_payment_info(self, ride_id):
        return get_payment_info(ride_id, self.user)


class DemoPaymentRiderMixin(_DemoPaymentCommonMixin):
    async def demo_payment_receive(self, msg_type, data):
        if msg_type == "get_payment_info":
            await self.demo_handle_get_payment_info(data)
            return True
        if msg_type == "pay":
            await self.demo_handle_pay(data)
            return True
        return False

    async def demo_handle_pay(self, data):
        ride_id = data.get("ride_id")
        method = data.get("method")
        if ride_id is None or not method:
            await self._demo_send({
                "type": "error",
                "detail": "ride_id and method are required.",
            })
            return

        try:
            result = await self._demo_run_pay(ride_id, method, data)
        except Exception:
            result = {"success": False, "detail": "Something went wrong.", "paid": False}

        await self._demo_send({
            "type": "pay_success" if result["success"] else "pay_failed",
            "ride_id": ride_id,
            "method": method,
            "paid": result.get("paid", False),
            "detail": result["detail"],
        })

    @database_sync_to_async
    def _demo_run_pay(self, ride_id, method, data):
        return pay_ride(ride_id, self.user, method, data)


class DemoPaymentDriverMixin(_DemoPaymentCommonMixin):
    async def demo_payment_receive(self, msg_type, data):
        if msg_type == "get_payment_info":
            await self.demo_handle_get_payment_info(data)
            return True
        return False

    async def payment_received(self, event):
        await self._demo_send({
            "type": "payment_received",
            "ride_id": event["ride_id"],
            "method": event["method"],
            "amount": event["amount"],
            "rider_number": event.get("rider_number"),
        })