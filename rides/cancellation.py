import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache

from drivers.models import DriverProfile
from .models import Ride, RideOffer

logger = logging.getLogger(__name__)

NOTIFIED_TTL = 60 * 60


def _notified_key(ride_id):
    return f"ride_notified_drivers_{ride_id}"


def remember_notified_driver(ride_id, driver_user_id):
    """
    Dispatch yahi call karta hai. Ab ye DB mein RideOffer bhi banata hai,
    cache sirf backup hai.
    """
    try:
        driver = DriverProfile.objects.filter(user_id=driver_user_id).first()
        if driver is not None:
            RideOffer.objects.get_or_create(ride_id=ride_id, driver=driver)
    except Exception:
        logger.exception("Failed to save RideOffer ride=%s user=%s", ride_id, driver_user_id)

    key = _notified_key(ride_id)
    ids = cache.get(key) or set()
    ids.add(driver_user_id)
    cache.set(key, ids, timeout=NOTIFIED_TTL)


def _notify_offered_drivers(ride: Ride, event_type: str, extra: dict):
    # 1) DB se (main source)
    offers = RideOffer.objects.filter(ride=ride, status=RideOffer.Status.SENT)
    ids = set(offers.values_list("driver__user_id", flat=True))

    # 2) Backup: Ride.notified_driver_user_ids aur cache
    ids.update(ride.notified_driver_user_ids or [])
    ids.update(cache.get(_notified_key(ride.id)) or set())

    logger.info("offered drivers for ride %s = %s", ride.id, ids)
    if not ids:
        logger.warning("No offered drivers found for ride %s", ride.id)

    payload = {"type": event_type, "ride_id": ride.id, **extra}
    channel_layer = get_channel_layer()

    for uid in ids:
        try:
            async_to_sync(channel_layer.group_send)(f"driver_{uid}", payload)
        except Exception:
            logger.exception("Failed to notify offered driver %s for ride %s", uid, ride.id)

    offers.update(status=RideOffer.Status.EXPIRED)
    cache.delete(_notified_key(ride.id))


def cancel_ride_by_rider(ride_id, rider_user, reason=""):
    ride = Ride.objects.select_related("driver").filter(id=ride_id, rider=rider_user).first()
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
    else:
        _notify_offered_drivers(ride, "ride_cancelled", {"cancelled_by": "RIDER"})
    _notify_rider(ride, "ride_cancelled", {"cancelled_by": "RIDER"})

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
    # Sirf BUSY driver ko ONLINE karo, OFFLINE wale ko overwrite mat karo
    DriverProfile.objects.filter(
        pk=driver_profile.pk, status=DriverProfile.Status.BUSY,
    ).update(status=DriverProfile.Status.ONLINE)


def _notify_driver(ride: Ride, event_type: str, extra: dict):
    try:
        channel_layer = get_channel_layer()
        payload = {"type": event_type, "ride_id": ride.id, **extra}
        async_to_sync(channel_layer.group_send)(f"driver_{ride.driver.user_id}", payload)
    except Exception:
        logger.exception("Failed to notify driver for ride %s", ride.id)


def _notify_rider(ride: Ride, event_type: str, extra: dict):
    try:
        channel_layer = get_channel_layer()
        payload = {"type": event_type, "ride_id": ride.id, **extra}
        async_to_sync(channel_layer.group_send)(f"rider_{ride.rider_id}", payload)
    except Exception:
        logger.exception("Failed to notify rider for ride %s", ride.id)