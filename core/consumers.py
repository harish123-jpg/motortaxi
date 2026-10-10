import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.gis.geos import Point
from django.utils import timezone

from drivers.models import DriverProfile
from rides.expiry import ensure_expiry_loop

from rides.payments import DemoPaymentDriverMixin, DemoPaymentRiderMixin

logger = logging.getLogger(__name__)


class DriverConsumer(DemoPaymentDriverMixin, AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        has_profile = await self.has_driver_profile()
        if not has_profile:
            await self.close(code=4004)
            return

        self.group_name = f"driver_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        ensure_expiry_loop()

        profile = await self.get_profile()
        await self.touch_session(profile)

        await self.send(text_data=json.dumps({
            "type": "connected",
            "detail": "Driver WebSocket connected."
        }))

        await self.send_current_state()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_current_state(self):
        profile = await self.get_profile()
        state = await self.get_current_state(profile)
        await self.send(text_data=json.dumps({
            "type": "current_state",
            **state,
        }))

    async def ride_request(self, event):
        logger.info("ride_request reached consumer user=%s channel=%s", self.user.id, self.channel_name)
        await self.send(text_data=json.dumps({
            "type": "ride_request",
            "ride_id": event["ride_id"],
            "vehicle_type": event["vehicle_type"],
            "pickup_address": event["pickup_address"],
            "pickup_lat": event["pickup_lat"],
            "pickup_lon": event["pickup_lon"],
            "drop_address": event["drop_address"],
            "distance_km": event["distance_km"],
            "driver_payout": event["driver_payout"],
            "currency": event["currency"],
        }))

    async def ride_taken(self, event):
        await self.send(text_data=json.dumps({
            "type": "ride_taken",
            "ride_id": event["ride_id"],
        }))

    async def ride_cancelled(self, event):
        logger.info("ride_cancelled reached consumer user=%s event=%s", self.user.id, event)
        await self.send(text_data=json.dumps({
            "type": "ride_cancelled",
            "ride_id": event["ride_id"],
            "cancelled_by": event.get("cancelled_by"),
        }))

    async def ride_expired(self, event):
        logger.info("ride_expired reached consumer user=%s event=%s", self.user.id, event)
        await self.send(text_data=json.dumps({
            "type": "ride_expired",
            "ride_id": event["ride_id"],
        }))

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        # DEMO PAYMENT: start (real payment aane par hata do)
        if await self.demo_payment_receive(msg_type, data):
            return
        # DEMO PAYMENT: end

        if msg_type == "location_update":
            await self.handle_location_update(data)
        elif msg_type == "accept_ride":
            await self.handle_accept_ride(data)
        elif msg_type == "reject_ride":
            await self.handle_reject_ride(data)
        elif msg_type == "arrived":
            await self.handle_trip_action(data, "mark_arrived")
        elif msg_type == "start_trip":
            await self.handle_start_trip(data)
        elif msg_type == "complete_trip":
            await self.handle_trip_action(data, "complete_trip")
        elif msg_type == "cancel_ride":
            await self.handle_cancel_ride(data)
        elif msg_type == "get_status":
            await self.send_current_state()
        elif msg_type == "ping":
            profile = await self.get_profile()
            await self.touch_session(profile)
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def handle_start_trip(self, data):
        ride_id = data.get("ride_id")
        otp = data.get("otp")

        if ride_id is None or otp is None:
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "ride_id and otp are required."
            }))
            return

        profile = await self.get_profile()
        result = await self.run_start_trip(ride_id, profile, otp)

        await self.send(text_data=json.dumps({
            "type": "start_trip_success" if result["success"] else "start_trip_failed",
            "ride_id": ride_id,
            "detail": result["detail"],
        }))

    async def handle_trip_action(self, data, action_name):
        ride_id = data.get("ride_id")
        if ride_id is None:
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "ride_id is required."
            }))
            return

        profile = await self.get_profile()
        result = await self.run_trip_action(action_name, ride_id, profile)

        await self.send(text_data=json.dumps({
            "type": f"{action_name}_success" if result["success"] else f"{action_name}_failed",
            "ride_id": ride_id,
            "detail": result["detail"],
        }))

    async def handle_accept_ride(self, data):
        ride_id = data.get("ride_id")
        if ride_id is None:
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "ride_id is required."
            }))
            return

        profile = await self.get_profile()
        result = await self.try_accept_ride(ride_id, profile)

        await self.send(text_data=json.dumps({
            "type": "accept_success" if result["success"] else "accept_failed",
            "ride_id": ride_id,
            "detail": result["detail"],
        }))

    async def handle_reject_ride(self, data):
        ride_id = data.get("ride_id")
        if ride_id is None:
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "ride_id is required."
            }))
            return

        profile = await self.get_profile()
        result = await self.try_reject_ride(ride_id, profile)

        await self.send(text_data=json.dumps({
            "type": "reject_success" if result["success"] else "reject_failed",
            "ride_id": ride_id,
            "detail": result["detail"],
        }))

    async def handle_cancel_ride(self, data):
        ride_id = data.get("ride_id")
        if ride_id is None:
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "ride_id is required."
            }))
            return

        reason = data.get("reason", "")
        profile = await self.get_profile()
        result = await self.try_driver_cancel(ride_id, profile, reason)

        await self.send(text_data=json.dumps({
            "type": "cancel_ride_success" if result["success"] else "cancel_ride_failed",
            "ride_id": ride_id,
            "detail": result["detail"],
        }))

    async def handle_location_update(self, data):
        profile = await self.get_profile()

        if profile.status not in (
                DriverProfile.Status.ONLINE,
                DriverProfile.Status.BUSY,
                DriverProfile.Status.ON_TRIP,
        ):
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "Location updates only allowed while online, assigned or on trip."
            }))
            return

        lat = data.get("lat")
        lng = data.get("lng")
        if lat is None or lng is None:
            return

        try:
            lat = float(lat)
            lng = float(lng)
        except (TypeError, ValueError):
            return

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return

        await self.touch_session(profile)
        progress = await self.save_location_and_get_progress(profile, lat, lng)
        await self.send(text_data=json.dumps({
            "type": "location_ack",
            "lat": lat,
            "lng": lng,
            "status": profile.status,
            "ride_id": progress["ride_id"] if progress else None,
            "target": progress["target"] if progress else None,
            "distance_remaining_km": progress["distance_remaining_km"] if progress else None,
            "eta_min": progress["eta_min"] if progress else None,
        }))

        if progress:
            await self.channel_layer.group_send(
                f"rider_{progress['rider_id']}",
                {
                    "type": "driver_location",
                    "lat": lat,
                    "lng": lng,
                    "status": profile.status,
                    "ride_id": progress["ride_id"],
                    "target": progress["target"],
                    "distance_remaining_km": progress["distance_remaining_km"],
                    "eta_min": progress["eta_min"],
                },
            )

    @database_sync_to_async
    def get_profile(self):
        return DriverProfile.objects.get(user=self.user)

    @database_sync_to_async
    def has_driver_profile(self):
        return DriverProfile.objects.filter(user=self.user).exists()

    @database_sync_to_async
    def touch_session(self, profile):
        from drivers.models import DriverSession
        DriverSession.objects.filter(driver=profile, ended_at__isnull=True).update(
            last_seen_at=timezone.now()
        )

    @database_sync_to_async
    def get_current_state(self, profile):
        from rides.trip import get_driver_current_state
        return get_driver_current_state(profile)

    @database_sync_to_async
    def save_location_and_get_progress(self, profile, lat, lng):
        from rides.trip import get_trip_progress

        profile.current_location = Point(lng, lat, srid=4326)
        profile.save(update_fields=["current_location", "updated_at"])

        return get_trip_progress(profile, lat, lng)

    @database_sync_to_async
    def try_accept_ride(self, ride_id, profile):
        from rides.acceptance import accept_ride
        return accept_ride(ride_id, profile)

    @database_sync_to_async
    def try_reject_ride(self, ride_id, profile):
        from rides.acceptance import reject_ride
        return reject_ride(ride_id, profile)

    @database_sync_to_async
    def try_driver_cancel(self, ride_id, profile, reason):
        from rides.cancellation import cancel_ride_by_driver
        return cancel_ride_by_driver(ride_id, profile, reason)

    @database_sync_to_async
    def run_trip_action(self, action_name, ride_id, profile):
        from rides import trip
        action = getattr(trip, action_name)
        return action(ride_id, profile)

    @database_sync_to_async
    def run_start_trip(self, ride_id, profile, otp):
        from rides.trip import start_trip
        return start_trip(ride_id, profile, otp)


class RiderConsumer(DemoPaymentRiderMixin, AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f"rider_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        ensure_expiry_loop()

        await self.send(text_data=json.dumps({
            "type": "connected",
            "detail": "Rider WebSocket connected."
        }))
        await self.send_current_state()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        # DEMO PAYMENT: start
        if await self.demo_payment_receive(msg_type, data):
            return
        # DEMO PAYMENT: end

        if msg_type == "cancel_ride":
            await self.handle_cancel_ride(data)
        elif msg_type == "get_status":
            await self.send_current_state()
        elif msg_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def send_current_state(self):
        state = await self.get_current_state()
        await self.send(text_data=json.dumps({
            "type": "current_state",
            **state,
        }))

    async def handle_cancel_ride(self, data):
        ride_id = data.get("ride_id")
        if ride_id is None:
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "ride_id is required."
            }))
            return

        reason = data.get("reason", "")
        try:
            result = await self.try_rider_cancel(ride_id, reason)
        except Exception:
            logger.exception("Rider cancel failed ride=%s", ride_id)
            result = {"success": False, "detail": "Something went wrong."}

        await self.send(text_data=json.dumps({
            "type": "cancel_ride_success" if result["success"] else "cancel_ride_failed",
            "ride_id": ride_id,
            "detail": result["detail"],
        }))

    @database_sync_to_async
    def try_rider_cancel(self, ride_id, reason):
        from rides.cancellation import cancel_ride_by_rider
        return cancel_ride_by_rider(ride_id, self.user, reason)

    @database_sync_to_async
    def get_current_state(self):
        from rides.trip import get_rider_current_state
        return get_rider_current_state(self.user)

    async def driver_location(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_location",
            "lat": event["lat"],
            "lng": event["lng"],
            "status": event.get("status"),
            "ride_id": event.get("ride_id"),
            "target": event.get("target"),
            "distance_remaining_km": event.get("distance_remaining_km"),
            "eta_min": event.get("eta_min"),
        }))

    async def driver_assigned(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_assigned",
            "ride_id": event["ride_id"],
            "driver_name": event["driver_name"],
            "driver_phone": event["driver_phone"],
            "driver_rating": event["driver_rating"],
            "vehicle_make": event["vehicle_make"],
            "vehicle_model": event["vehicle_model"],
            "vehicle_plate": event["vehicle_plate"],
            "distance_remaining_km": event.get("distance_remaining_km"),
            "eta_min": event.get("eta_min"),
        }))

    async def driver_arrived(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_arrived",
            "ride_id": event["ride_id"],
        }))

    async def trip_started(self, event):
        await self.send(text_data=json.dumps({
            "type": "trip_started",
            "ride_id": event["ride_id"],
        }))

    async def trip_completed(self, event):
        await self.send(text_data=json.dumps({
            "type": "trip_completed",
            "ride_id": event["ride_id"],
            "final_fare": event["final_fare"],
            "payment_status": event["payment_status"],
        }))

    async def ride_cancelled(self, event):
        await self.send(text_data=json.dumps({
            "type": "ride_cancelled",
            "ride_id": event["ride_id"],
            "cancelled_by": event.get("cancelled_by"),
        }))

    async def ride_expired(self, event):
        await self.send(text_data=json.dumps({
            "type": "ride_expired",
            "ride_id": event["ride_id"],
            "detail": "No driver found. Please try again.",
        }))