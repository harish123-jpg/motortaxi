from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from drivers.models import DriverProfile
from .models import Ride, RideOffer


def accept_ride(ride_id, driver_profile: DriverProfile):
    """
    Atomically tries to claim a ride for this driver.

    Uses a single conditional UPDATE (status=SEARCHING -> ACCEPTED) so
    that if two drivers accept at the same instant, the database
    guarantees only one UPDATE succeeds -- no manual locking needed.
    """
    rows_updated = Ride.objects.filter(
        id=ride_id, status=Ride.Status.SEARCHING
    ).update(status=Ride.Status.ACCEPTED, driver=driver_profile)

    if rows_updated == 0:
        return {"success": False, "detail": "Ride no longer available.", "ride": None}

    ride = Ride.objects.select_related("rider").get(id=ride_id)
    now = timezone.now()

    RideOffer.objects.filter(ride=ride, driver=driver_profile).update(
        status=RideOffer.Status.ACCEPTED, responded_at=now
    )

    other_driver_user_ids = list(
        RideOffer.objects.filter(ride=ride, status=RideOffer.Status.SENT)
        .exclude(driver=driver_profile)
        .values_list("driver__user_id", flat=True)
    )
    RideOffer.objects.filter(ride=ride, status=RideOffer.Status.SENT).exclude(
        driver=driver_profile
    ).update(status=RideOffer.Status.EXPIRED, responded_at=now)

    driver_profile.status = DriverProfile.Status.BUSY
    driver_profile.save(update_fields=["status", "updated_at"])

    _notify_rider(ride, driver_profile)
    _notify_other_drivers(ride, other_driver_user_ids)

    return {"success": True, "detail": "Ride accepted.", "ride": ride}


def reject_ride(ride_id, driver_profile: DriverProfile):
    """
    Marks this driver's offer as REJECTED. Does not affect the ride
    itself -- other drivers' offers are untouched and matching continues
    normally until someone accepts or all offers expire.
    """
    rows_updated = RideOffer.objects.filter(
        ride_id=ride_id, driver=driver_profile, status=RideOffer.Status.SENT
    ).update(status=RideOffer.Status.REJECTED, responded_at=timezone.now())

    if rows_updated == 0:
        return {"success": False, "detail": "Offer already responded to or not found."}

    return {"success": True, "detail": "Ride rejected."}


def _notify_rider(ride: Ride, driver_profile: DriverProfile):
    channel_layer = get_channel_layer()
    vehicle = driver_profile.vehicles.filter(is_active=True).first()

    payload = {
        "type": "driver_assigned",
        "ride_id": ride.id,
        "driver_name": driver_profile.user.full_name,
        "driver_phone": driver_profile.user.phone_number,
        "driver_rating": float(driver_profile.rating_avg),
        "vehicle_make": vehicle.make if vehicle else None,
        "vehicle_model": vehicle.model if vehicle else None,
        "vehicle_plate": vehicle.plate_number if vehicle else None,
    }

    async_to_sync(channel_layer.group_send)(f"rider_{ride.rider_id}", payload)


def _notify_other_drivers(ride: Ride, other_driver_user_ids):
    channel_layer = get_channel_layer()
    payload = {"type": "ride_taken", "ride_id": ride.id}

    for user_id in other_driver_user_ids:
        async_to_sync(channel_layer.group_send)(f"driver_{user_id}", payload)