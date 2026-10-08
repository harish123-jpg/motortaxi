import logging
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from drivers.models import DriverProfile
from .models import Ride, RideOffer

logger = logging.getLogger(__name__)

NOTIFIED_TTL = 60 * 60
SEARCH_TIMEOUT_MINUTES = 2


def _notified_key(ride_id):
    return f"ride_notified_drivers_{ride_id}"


def remember_notified_driver(ride_id, driver_user_id):
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


def _offered_driver_user_ids(ride):
    ids = set(
        RideOffer.objects.filter(ride=ride).values_list("driver__user_id", flat=True)
    )
    ids.update(ride.notified_driver_user_ids or [])
    ids.update(cache.get(_notified_key(ride.id)) or set())
    return ids


def _group_send(group, payload):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(group, payload)
    except Exception:
        logger.exception("group_send failed group=%s", group)


def _delete_searching_ride(ride_id, cancelled_by, rider_user=None):
    qs = Ride.objects.filter(id=ride_id, status=Ride.Status.SEARCHING)
    if rider_user is not None:
        qs = qs.filter(rider=rider_user)

    ride = qs.first()
    if ride is None:
        return None

    driver_user_ids = _offered_driver_user_ids(ride)
    rider_id = ride.rider_id
    ride_pk = ride.id

    with transaction.atomic():
        deleted, _ = Ride.objects.filter(
            id=ride_pk, status=Ride.Status.SEARCHING
        ).delete()

    if deleted == 0:
        return None

    cache.delete(_notified_key(ride_pk))

    event_type = "ride_expired" if cancelled_by == "SYSTEM" else "ride_cancelled"
    payload = {"type": event_type, "ride_id": ride_pk, "cancelled_by": cancelled_by}
    for uid in driver_user_ids:
        _group_send(f"driver_{uid}", payload)
    _group_send(f"rider_{rider_id}", payload)

    ride.status = Ride.Status.CANCELLED
    return ride


def expire_stale_searching_rides(minutes=SEARCH_TIMEOUT_MINUTES):
    cutoff = timezone.now() - timedelta(minutes=minutes)
    ride_ids = list(
        Ride.objects.filter(
            status=Ride.Status.SEARCHING, created_at__lte=cutoff
        ).values_list("id", flat=True)
    )
    expired = 0
    for rid in ride_ids:
        if _delete_searching_ride(rid, "SYSTEM") is not None:
            expired += 1
    return expired


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

    if ride.status == Ride.Status.SEARCHING:
        deleted_ride = _delete_searching_ride(ride_id, "RIDER", rider_user=rider_user)
        if deleted_ride is not None:
            return {"success": True, "detail": "Ride cancelled.", "ride": deleted_ride}

        ride = Ride.objects.select_related("driver").filter(id=ride_id, rider=rider_user).first()
        if ride is None or ride.status != Ride.Status.ACCEPTED:
            return {"success": False, "detail": "Ride state changed, please retry.", "ride": None}

    rows_updated = Ride.objects.filter(
        id=ride_id, status=Ride.Status.ACCEPTED,
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
    _notify_rider(ride, "ride_cancelled", {"cancelled_by": "RIDER"})

    return {"success": True, "detail": "Ride cancelled.", "ride": ride}


def cancel_ride_by_driver(ride_id, driver_profile, reason=""):
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


def _free_driver(driver_profile):
    DriverProfile.objects.filter(
        pk=driver_profile.pk, status=DriverProfile.Status.BUSY,
    ).update(status=DriverProfile.Status.ONLINE)


def _notify_driver(ride, event_type, extra):
    payload = {"type": event_type, "ride_id": ride.id, **extra}
    _group_send(f"driver_{ride.driver.user_id}", payload)


def _notify_rider(ride, event_type, extra):
    payload = {"type": event_type, "ride_id": ride.id, **extra}
    _group_send(f"rider_{ride.rider_id}", payload)