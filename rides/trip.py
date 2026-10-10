import math
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from drivers.models import DriverProfile
from drivers.wallet import credit_ride_earning
from .fare_estimate import CURRENCY
from .models import Ride, RideOffer

EARTH_RADIUS_KM = 6371.0
ASSUMED_AVG_SPEED_KMPH = 25

ACTIVE_RIDE_STATUSES = [
    Ride.Status.ACCEPTED,
    Ride.Status.ONGOING,
]

ACTIVE_RIDER_STATUSES = [
    Ride.Status.SEARCHING,
    Ride.Status.ACCEPTED,
    Ride.Status.ONGOING,
]


def _haversine_distance(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(EARTH_RADIUS_KM * c, 2)


def mark_arrived(ride_id, driver_profile: DriverProfile):
    try:
        ride = Ride.objects.get(id=ride_id, driver=driver_profile, status=Ride.Status.ACCEPTED)
    except Ride.DoesNotExist:
        return {"success": False, "detail": "Ride not found or not in ACCEPTED state."}

    ride.arrived_at = timezone.now()
    ride.save(update_fields=["arrived_at", "updated_at"])

    _notify_rider(ride, "driver_arrived", {})
    return {"success": True, "detail": "Marked as arrived."}


def start_trip(ride_id, driver_profile: DriverProfile, otp: str):
    try:
        ride = Ride.objects.get(id=ride_id, driver=driver_profile, status=Ride.Status.ACCEPTED)
    except Ride.DoesNotExist:
        return {"success": False, "detail": "Ride not found or not in ACCEPTED state."}

    if ride.otp != str(otp):
        return {"success": False, "detail": "Invalid OTP."}

    ride.status = Ride.Status.ONGOING
    ride.started_at = timezone.now()
    ride.save(update_fields=["status", "started_at", "updated_at"])

    driver_profile.status = DriverProfile.Status.ON_TRIP
    driver_profile.save(update_fields=["status", "updated_at"])

    _notify_rider(ride, "trip_started", {})
    return {"success": True, "detail": "Trip started.", "ride": ride}


def complete_trip(ride_id, driver_profile: DriverProfile):
    with transaction.atomic():
        try:
            ride = Ride.objects.select_for_update().get(
                id=ride_id, driver=driver_profile, status=Ride.Status.ONGOING
            )
        except Ride.DoesNotExist:
            if Ride.objects.filter(
                id=ride_id, driver=driver_profile, status=Ride.Status.COMPLETED
            ).exists():
                return {"success": True, "detail": "Trip already completed."}
            return {"success": False, "detail": "Ride not found or not in ONGOING state."}

        from .payments import demo_payment_block_reason
        block_reason = demo_payment_block_reason(ride)
        if block_reason:
            return {"success": False, "detail": block_reason}

        ride.status = Ride.Status.COMPLETED
        ride.final_fare = ride.estimated_fare
        ride.payment_status = Ride.PaymentStatus.PAID
        ride.completed_at = timezone.now()
        ride.save(update_fields=["status", "final_fare", "payment_status", "completed_at", "updated_at"])

        driver_profile.status = DriverProfile.Status.ONLINE
        driver_profile.total_trips += 1
        driver_profile.save(update_fields=["status", "total_trips", "updated_at"])

        credit_ride_earning(driver_profile, ride, ride.driver_payout)

    _notify_rider(ride, "trip_completed", {
        "final_fare": float(ride.final_fare),
        "payment_status": ride.payment_status,
    })
    return {"success": True, "detail": "Trip completed.", "ride": ride}

def get_trip_progress(driver_profile: DriverProfile, lat: float, lng: float):
    """
    Given the driver's just-reported lat/lng, works out which active
    ride they're on (if any), which point they're heading to (pickup
    while ACCEPTED, drop while ONGOING), and how far/how long that is.
    Returns None if the driver has no active ride right now.
    """
    ride = Ride.objects.filter(
        driver=driver_profile,
        status__in=ACTIVE_RIDE_STATUSES,
    ).first()
    if not ride:
        return None

    if ride.status == Ride.Status.ACCEPTED:
        target_lat, target_lon, target = float(ride.pickup_lat), float(ride.pickup_lon), "pickup"
    else:
        target_lat, target_lon, target = float(ride.drop_lat), float(ride.drop_lon), "drop"

    distance_km = _haversine_distance(lat, lng, target_lat, target_lon)
    eta_min = max(1, round((distance_km / ASSUMED_AVG_SPEED_KMPH) * 60))

    return {
        "ride_id": ride.id,
        "rider_id": ride.rider_id,
        "target": target,
        "distance_remaining_km": distance_km,
        "eta_min": eta_min,
    }


def get_current_status_info(driver_profile: DriverProfile):
    """Purana lightweight helper (ab get_driver_current_state use hota hai)."""
    ride = Ride.objects.filter(
        driver=driver_profile,
        status__in=ACTIVE_RIDE_STATUSES,
    ).first()

    info = {"status": driver_profile.status, "ride_id": None, "target": None}
    if ride:
        info["ride_id"] = ride.id
        info["target"] = "pickup" if ride.status == Ride.Status.ACCEPTED else "drop"
    return info


def get_ongoing_rider_group(driver_profile: DriverProfile):
    ride = Ride.objects.filter(
        driver=driver_profile,
        status__in=ACTIVE_RIDE_STATUSES,
    ).first()
    if not ride:
        return None
    return f"rider_{ride.rider_id}"


def _notify_rider(ride: Ride, event_type: str, extra: dict):
    channel_layer = get_channel_layer()
    payload = {"type": event_type, "ride_id": ride.id, **extra}
    async_to_sync(channel_layer.group_send)(f"rider_{ride.rider_id}", payload)


# =====================================================================
# COMMON HELPERS
# =====================================================================

def _num(value):
    return float(value) if value is not None else None


def _iso(dt):
    return dt.isoformat() if dt else None


def _attr(obj, name, default=None):
    """Optional field safely padho (agar tumhare model mein na ho toh None)."""
    return getattr(obj, name, default) if obj is not None else default


def _eta(distance_km):
    if distance_km is None:
        return None
    return max(1, round((distance_km / ASSUMED_AVG_SPEED_KMPH) * 60))


def _vehicle_block(driver):
    vehicle = driver.vehicles.filter(is_active=True).first()
    if not vehicle:
        return None
    return {
        "make": _attr(vehicle, "make"),
        "model": _attr(vehicle, "model"),
        "plate_number": _attr(vehicle, "plate_number"),
        "color": _attr(vehicle, "color"),
        "year": _attr(vehicle, "year"),
        "vehicle_type": _attr(vehicle, "vehicle_type"),
    }


def _progress_block(ride, d_lat, d_lng):
    """Driver ki location se pickup/drop tak distance + ETA."""
    pickup_lat, pickup_lon = float(ride.pickup_lat), float(ride.pickup_lon)
    drop_lat, drop_lon = float(ride.drop_lat), float(ride.drop_lon)

    driver_to_pickup = driver_to_drop = None
    if d_lat is not None and d_lng is not None:
        driver_to_pickup = _haversine_distance(d_lat, d_lng, pickup_lat, pickup_lon)
        driver_to_drop = _haversine_distance(d_lat, d_lng, drop_lat, drop_lon)

    if ride.status == Ride.Status.ACCEPTED:
        target, distance_remaining = "pickup", driver_to_pickup
    else:  # ONGOING
        target, distance_remaining = "drop", driver_to_drop

    return {
        "target": target,
        "distance_remaining_km": distance_remaining,
        "eta_min": _eta(distance_remaining),
        "driver_to_pickup_km": driver_to_pickup,
        "driver_to_pickup_eta_min": _eta(driver_to_pickup),
        "driver_to_drop_km": driver_to_drop,
        "driver_to_drop_eta_min": _eta(driver_to_drop),
        "pickup_to_drop_km": _haversine_distance(pickup_lat, pickup_lon, drop_lat, drop_lon),
    }


def _stage_for_active_ride(ride):
    arrived_at = _attr(ride, "arrived_at")
    if ride.status == Ride.Status.ONGOING:
        return "trip_ongoing"
    return "driver_arrived" if arrived_at else "driver_on_the_way"


# =====================================================================
# RIDER CURRENT STATE
# =====================================================================

def _rider_block(user):
    return {
        "rider_id": user.id,
        "name": _attr(user, "full_name"),
        "phone": _attr(user, "phone_number"),
    }


def get_rider_current_state(user):
    """
    stage:
      none               -> koi active ride nahi
      searching          -> driver dhoondh rahe hain
      driver_on_the_way  -> driver assign, pickup ki taraf aa raha hai
      driver_arrived     -> driver pickup pe pahunch gaya (arrived_at field chahiye)
      trip_ongoing       -> trip chal rahi hai, drop ki taraf
    """
    ride = (
        Ride.objects.filter(rider=user, status__in=ACTIVE_RIDER_STATUSES)
        .select_related("rider", "driver__user")
        .order_by("-created_at")
        .first()
    )
    if not ride:
        return {
            "has_active_ride": False,
            "stage": "none",
            "rider": _rider_block(user),
            "ride": None,
            "driver": None,
            "vehicle": None,
            "progress": None,
            "flags": None,
        }

    arrived_at = _attr(ride, "arrived_at")

    if ride.status == Ride.Status.SEARCHING:
        stage = "searching"
    else:
        stage = _stage_for_active_ride(ride)

    ride_block = {
        "ride_id": ride.id,
        "status": ride.status,
        "stage": stage,
        "vehicle_type": _attr(ride, "vehicle_type"),
        "pickup": {
            "address": ride.pickup_address,
            "lat": float(ride.pickup_lat),
            "lon": float(ride.pickup_lon),
        },
        "drop": {
            "address": ride.drop_address,
            "lat": float(ride.drop_lat),
            "lon": float(ride.drop_lon),
        },
        "trip_distance_km": _num(_attr(ride, "distance_km")),
        "estimated_duration_min": _attr(ride, "estimated_duration_min"),
        "estimated_fare": _num(ride.estimated_fare),
        "final_fare": _num(_attr(ride, "final_fare")),
        "currency": CURRENCY,
        "payment_method": _attr(ride, "payment_method"),
        "payment_status": _attr(ride, "payment_status"),
        "otp": _attr(ride, "otp") if ride.status == Ride.Status.ACCEPTED else None,
        "created_at": _iso(_attr(ride, "created_at")),
        "updated_at": _iso(_attr(ride, "updated_at")),
        "arrived_at": _iso(arrived_at),
    }

    driver = ride.driver
    driver_block = None
    vehicle_block = None
    progress_block = None

    if driver:
        loc = driver.current_location
        d_lat = loc.y if loc else None
        d_lng = loc.x if loc else None

        driver_block = {
            "driver_id": driver.id,
            "name": driver.user.full_name,
            "phone": driver.user.phone_number,
            "rating": _num(_attr(driver, "rating_avg")),
            "total_trips": _attr(driver, "total_trips"),
            "status": driver.status,
            "location": {
                "lat": d_lat,
                "lng": d_lng,
                "last_updated": _iso(_attr(driver, "updated_at")),
            },
        }
        vehicle_block = _vehicle_block(driver)
        progress_block = _progress_block(ride, d_lat, d_lng)

    flags = {
        "is_searching": ride.status == Ride.Status.SEARCHING,
        "driver_assigned": driver is not None,
        "driver_arrived": bool(arrived_at),
        "trip_started": ride.status == Ride.Status.ONGOING,
        "can_cancel": ride.status in (Ride.Status.SEARCHING, Ride.Status.ACCEPTED),
    }

    return {
        "has_active_ride": True,
        "stage": stage,
        "rider": _rider_block(ride.rider),
        "ride": ride_block,
        "driver": driver_block,
        "vehicle": vehicle_block,
        "progress": progress_block,
        "flags": flags,
    }


# =====================================================================
# DRIVER CURRENT STATE
# =====================================================================

def get_driver_current_state(driver_profile: DriverProfile):
    """
    stage:
      offline            -> driver online nahi hai
      online_idle        -> online hai, koi ride nahi (pending_offers dekho)
      driver_on_the_way  -> ride accept ki, pickup ki taraf ja raha hai
      driver_arrived     -> pickup pe pahunch gaya (arrived_at field chahiye)
      trip_ongoing       -> trip chal rahi hai, drop ki taraf

    NOTE: driver ko OTP nahi bheja jata (rider driver ko batata hai).
    """
    driver_profile = DriverProfile.objects.select_related("user").get(pk=driver_profile.pk)

    loc = driver_profile.current_location
    d_lat = loc.y if loc else None
    d_lng = loc.x if loc else None

    driver_block = {
        "driver_id": driver_profile.id,
        "name": driver_profile.user.full_name,
        "phone": driver_profile.user.phone_number,
        "status": driver_profile.status,
        "rating": _num(_attr(driver_profile, "rating_avg")),
        "total_trips": _attr(driver_profile, "total_trips"),
        "location": {
            "lat": d_lat,
            "lng": d_lng,
            "last_updated": _iso(_attr(driver_profile, "updated_at")),
        },
    }
    vehicle_block = _vehicle_block(driver_profile)

    ride = (
        Ride.objects.filter(driver=driver_profile, status__in=ACTIVE_RIDE_STATUSES)
        .select_related("rider")
        .order_by("-created_at")
        .first()
    )

    # ---------- Active ride nahi hai ----------
    if not ride:
        pending_offers = _pending_offers(driver_profile, d_lat, d_lng)
        online = driver_profile.status == DriverProfile.Status.ONLINE
        return {
            "has_active_ride": False,
            "stage": "online_idle" if online else "offline",
            "driver": driver_block,
            "vehicle": vehicle_block,
            "ride": None,
            "rider": None,
            "progress": None,
            "pending_offers": pending_offers,
            "flags": {
                "has_active_ride": False,
                "has_pending_offers": len(pending_offers) > 0,
                "can_cancel": False,
                "can_mark_arrived": False,
                "can_start_trip": False,
                "can_complete_trip": False,
            },
        }

    # ---------- Active ride hai ----------
    stage = _stage_for_active_ride(ride)
    arrived_at = _attr(ride, "arrived_at")

    ride_block = {
        "ride_id": ride.id,
        "status": ride.status,
        "stage": stage,
        "vehicle_type": _attr(ride, "vehicle_type"),
        "pickup": {
            "address": ride.pickup_address,
            "lat": float(ride.pickup_lat),
            "lon": float(ride.pickup_lon),
        },
        "drop": {
            "address": ride.drop_address,
            "lat": float(ride.drop_lat),
            "lon": float(ride.drop_lon),
        },
        "trip_distance_km": _num(_attr(ride, "distance_km")),
        "estimated_duration_min": _attr(ride, "estimated_duration_min"),
        "estimated_fare": _num(ride.estimated_fare),
        "final_fare": _num(_attr(ride, "final_fare")),
        "driver_payout": _num(_attr(ride, "driver_payout")),
        "currency": CURRENCY,
        "payment_method": _attr(ride, "payment_method"),
        "payment_status": _attr(ride, "payment_status"),
        "created_at": _iso(_attr(ride, "created_at")),
        "updated_at": _iso(_attr(ride, "updated_at")),
        "arrived_at": _iso(arrived_at),
    }

    return {
        "has_active_ride": True,
        "stage": stage,
        "driver": driver_block,
        "vehicle": vehicle_block,
        "ride": ride_block,
        "rider": _rider_block(ride.rider),
        "progress": _progress_block(ride, d_lat, d_lng),
        "pending_offers": [],
        "flags": {
            "has_active_ride": True,
            "has_pending_offers": False,
            "can_cancel": ride.status == Ride.Status.ACCEPTED,
            "can_mark_arrived": ride.status == Ride.Status.ACCEPTED and not arrived_at,
            "can_start_trip": ride.status == Ride.Status.ACCEPTED,
            "can_complete_trip": ride.status == Ride.Status.ONGOING,
        },
    }


def _pending_offers(driver_profile, d_lat, d_lng):
    """Jo ride requests driver ko bheji gayi thi aur abhi tak open hain."""
    offers = (
        RideOffer.objects.filter(
            driver=driver_profile,
            status=RideOffer.Status.SENT,
            ride__status=Ride.Status.SEARCHING,
        )
        .select_related("ride")
        .order_by("-id")
    )

    results = []
    for offer in offers:
        ride = offer.ride
        to_pickup = None
        if d_lat is not None and d_lng is not None:
            to_pickup = _haversine_distance(
                d_lat, d_lng, float(ride.pickup_lat), float(ride.pickup_lon)
            )
        results.append({
            "ride_id": ride.id,
            "vehicle_type": _attr(ride, "vehicle_type"),
            "pickup_address": ride.pickup_address,
            "pickup_lat": float(ride.pickup_lat),
            "pickup_lon": float(ride.pickup_lon),
            "drop_address": ride.drop_address,
            "distance_km": _num(_attr(ride, "distance_km")),
            "driver_payout": _num(_attr(ride, "driver_payout")),
            "currency": CURRENCY,
            "driver_to_pickup_km": to_pickup,
            "driver_to_pickup_eta_min": _eta(to_pickup),
        })
    return results