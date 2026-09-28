from django.db import transaction as db_transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from drivers.models import DriverProfile
from drivers.wallet import credit_ride_earning
from .models import Ride


def mark_arrived(ride_id, driver_profile: DriverProfile):
    """
    Driver pickup point pe pahunch gaya. Ride.status ACCEPTED hi rehta
    hai -- sirf ek timestamp aur rider-notification.
    """
    rows_updated = Ride.objects.filter(
        id=ride_id, driver=driver_profile,
        status=Ride.Status.ACCEPTED, arrived_at__isnull=True,
    ).update(arrived_at=timezone.now())

    if rows_updated == 0:
        return {"success": False, "detail": "Cannot mark arrived for this ride.", "ride": None}

    ride = Ride.objects.get(id=ride_id)
    _notify_rider_event(ride, "driver_arrived", {})
    return {"success": True, "detail": "Marked as arrived.", "ride": ride}


def start_trip(ride_id, driver_profile: DriverProfile, otp):
    """
    OTP verify karke trip start karta hai. OTP match nahi hui to fail.
    Match hui to Ride ACCEPTED -> ONGOING, driver BUSY -> ON_TRIP.
    """
    ride = Ride.objects.filter(
        id=ride_id, driver=driver_profile, status=Ride.Status.ACCEPTED,
    ).first()

    if ride is None:
        return {"success": False, "detail": "Trip cannot be started for this ride.", "ride": None}

    if str(otp) != str(ride.otp):
        return {"success": False, "detail": "Incorrect OTP.", "ride": None}

    rows_updated = Ride.objects.filter(
        id=ride_id, driver=driver_profile, status=Ride.Status.ACCEPTED,
    ).update(status=Ride.Status.ONGOING, started_at=timezone.now())

    if rows_updated == 0:
        return {"success": False, "detail": "Trip cannot be started for this ride.", "ride": None}

    driver_profile.status = DriverProfile.Status.ON_TRIP
    driver_profile.save(update_fields=["status", "updated_at"])

    ride = Ride.objects.get(id=ride_id)
    _notify_rider_event(ride, "trip_started", {})
    return {"success": True, "detail": "Trip started.", "ride": ride}


def complete_trip(ride_id, driver_profile: DriverProfile):
    """
    Ride ONGOING -> COMPLETED, payment turant PAID maan liya jaata hai
    (demo/MVP -- payment gateway integrate hone tak), driver ka wallet
    turant credit hota hai isi atomic block ke andar.
    """
    ride = Ride.objects.filter(
        id=ride_id, driver=driver_profile, status=Ride.Status.ONGOING,
    ).first()
    if ride is None:
        return {"success": False, "detail": "Trip cannot be completed for this ride.", "ride": None}

    payout = ride.driver_payout or 0

    with db_transaction.atomic():
        rows_updated = Ride.objects.filter(
            id=ride_id, driver=driver_profile, status=Ride.Status.ONGOING,
        ).update(
            status=Ride.Status.COMPLETED,
            final_fare=ride.estimated_fare,
            payment_status=Ride.PaymentStatus.PAID,
            completed_at=timezone.now(),
        )
        if rows_updated == 0:
            return {"success": False, "detail": "Trip cannot be completed for this ride.", "ride": None}

        driver_profile.status = DriverProfile.Status.ONLINE
        driver_profile.total_trips += 1
        driver_profile.save(update_fields=["status", "total_trips", "updated_at"])

        credit_ride_earning(driver_profile, ride, payout)

    ride.refresh_from_db()
    _notify_rider_event(ride, "trip_completed", {
        "final_fare": float(ride.final_fare),
        "payment_status": ride.payment_status,
    })
    return {"success": True, "detail": "Trip completed.", "ride": ride}


def get_ongoing_rider_group(driver_profile: DriverProfile):
    """
    Driver ki abhi chal rahi (ONGOING) ride dhundh ke us ride ke rider
    ka WebSocket group-name return karta hai. Live-location forwarding
    ke liye use hota hai (DriverConsumer.handle_location_update).
    """
    ride = (
        Ride.objects.filter(driver=driver_profile, status=Ride.Status.ONGOING)
        .order_by("-started_at")
        .first()
    )
    if ride is None:
        return None
    return f"rider_{ride.rider_id}"


def _notify_rider_event(ride: Ride, event_type: str, extra: dict):
    channel_layer = get_channel_layer()
    payload = {"type": event_type, "ride_id": ride.id, **extra}
    async_to_sync(channel_layer.group_send)(f"rider_{ride.rider_id}", payload)