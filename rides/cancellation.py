from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from drivers.models import DriverProfile
from .models import Ride


def cancel_ride_by_rider(ride_id, rider_user, reason=""):
    ride = Ride.objects.filter(id=ride_id, rider=rider_user).first()
    if ride is None:
        return {"success": False, "detail": "Ride not found.", "ride": None}

    if ride.status not in (Ride.Status.SEARCHING, Ride.Status.ACCEPTED):
        return {
            "success": False,
            "detail": f"Ride cannot be cancelled in '{ride.status}' state.",
            "ride": None,
        }

    rows_updated = Ride.objects.filter(
        id=ride_id, status=ride.status,
    ).update(
        status=Ride.Status.CANCELLED,
        cancelled_by=Ride.CancelledBy.RIDER,
        cancel_reason=reason,
    )
    if rows_updated == 0:
        return {"success": False, "detail": "Ride state changed, please retry.", "ride": None}

    ride.refresh_from_db()

    if ride.driver_id is not None:
        _free_driver(ride.driver)
        _notify_driver(ride, "ride_cancelled", {"cancelled_by": "RIDER"})

    return {"success": True, "detail": "Ride cancelled.", "ride": ride}


def cancel_ride_by_driver(ride_id, driver_profile: DriverProfile, reason=""):
    rows_updated = Ride.objects.filter(
        id=ride_id, driver=driver_profile, status=Ride.Status.ACCEPTED,
    ).update(
        status=Ride.Status.CANCELLED,
        cancelled_by=Ride.CancelledBy.DRIVER,
        cancel_reason=reason,
    )

    if rows_updated == 0:
        return {"success": False, "detail": "Ride cannot be cancelled at this stage.", "ride": None}

    _free_driver(driver_profile)

    ride = Ride.objects.get(id=ride_id)
    _notify_rider(ride, "ride_cancelled", {"cancelled_by": "DRIVER"})

    return {"success": True, "detail": "Ride cancelled.", "ride": ride}


def _free_driver(driver_profile: DriverProfile):
    driver_profile.status = DriverProfile.Status.ONLINE
    driver_profile.save(update_fields=["status", "updated_at"])


def _notify_driver(ride: Ride, event_type: str, extra: dict):
    channel_layer = get_channel_layer()
    payload = {"type": event_type, "ride_id": ride.id, **extra}
    async_to_sync(channel_layer.group_send)(f"driver_{ride.driver.user_id}", payload)


def _notify_rider(ride: Ride, event_type: str, extra: dict):
    channel_layer = get_channel_layer()
    payload = {"type": event_type, "ride_id": ride.id, **extra}
    async_to_sync(channel_layer.group_send)(f"rider_{ride.rider_id}", payload)