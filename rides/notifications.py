from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_eligible_drivers(ride, driver_payout, currency, eligible_drivers):
    """
    Pushes a "ride_request" event to each eligible driver's personal
    WebSocket group (f"driver_{user_id}"), matching DriverConsumer's
    group_add in consumers.py.

    driver_payout is computed ONCE for the booked vehicle_type (not
    per-driver -- all drivers of the same vehicle_type get the same
    payout for this ride) and sent to every candidate at once. Whoever
    accepts first gets the ride (accept/reject logic comes next).
    """
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
        group_name = f"driver_{driver.user_id}"
        async_to_sync(channel_layer.group_send)(group_name, payload)