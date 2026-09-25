from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import RideOffer


def create_and_notify_offers(ride, driver_payout, currency, eligible_drivers):
    """
    For every eligible driver:
    1. Creates a RideOffer row (status=SENT) -- this is the audit trail.
    2. Pushes a "ride_request" event to that driver's WebSocket group.
    """
    RideOffer.objects.bulk_create([
        RideOffer(ride=ride, driver=driver, status=RideOffer.Status.SENT)
        for driver in eligible_drivers
    ])

    channel_layer = get_channel_layer()
    payload = {
        "type": "ride_request",
        "ride_id": ride.id,
        "vehicle_type": ride.vehicle_type,
        "pickup_address": ride.pickup_address,
        "pickup_lat": float(ride.pickup_lat),
        "pickup_lon": float(ride.pickup_lon),
        "drop_address": ride.drop_address,
        "distance_km": float(ride.distance_km),
        "driver_payout": driver_payout,
        "currency": currency,
    }

    for driver in eligible_drivers:
        async_to_sync(channel_layer.group_send)(f"driver_{driver.user_id}", payload)