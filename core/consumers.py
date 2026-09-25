import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.gis.geos import Point

from drivers.models import DriverProfile


class DriverConsumer(AsyncWebsocketConsumer):
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

        await self.send(text_data=json.dumps({
            "type": "connected",
            "detail": "Driver WebSocket connected."
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def ride_request(self, event):
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

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        if msg_type == "location_update":
            await self.handle_location_update(data)
        elif msg_type == "accept_ride":
            await self.handle_accept_ride(data)
        elif msg_type == "reject_ride":
            await self.handle_reject_ride(data)

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

    async def handle_location_update(self, data):
        profile = await self.get_profile()

        if profile.status not in (DriverProfile.Status.ONLINE, DriverProfile.Status.ON_TRIP):
            await self.send(text_data=json.dumps({
                "type": "error",
                "detail": "Location updates only allowed while online."
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

        await self.save_location(lat, lng)

        await self.send(text_data=json.dumps({
            "type": "location_ack",
            "lat": lat,
            "lng": lng
        }))

        if profile.status == DriverProfile.Status.ON_TRIP:
            rider_group = await self.get_current_rider_group(profile)
            if rider_group:
                await self.channel_layer.group_send(
                    rider_group,
                    {
                        "type": "driver_location",
                        "lat": lat,
                        "lng": lng,
                    }
                )

    @database_sync_to_async
    def get_profile(self):
        return DriverProfile.objects.get(user=self.user)

    @database_sync_to_async
    def has_driver_profile(self):
        return DriverProfile.objects.filter(user=self.user).exists()

    @database_sync_to_async
    def save_location(self, lat, lng):
        profile = DriverProfile.objects.get(user=self.user)
        profile.current_location = Point(lng, lat, srid=4326)
        profile.save(update_fields=["current_location", "updated_at"])

    @database_sync_to_async
    def try_accept_ride(self, ride_id, profile):
        from rides.acceptance import accept_ride
        return accept_ride(ride_id, profile)

    @database_sync_to_async
    def try_reject_ride(self, ride_id, profile):
        from rides.acceptance import reject_ride
        return reject_ride(ride_id, profile)

    @database_sync_to_async
    def get_current_rider_group(self, profile):
        return None


class RiderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f"rider_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            "type": "connected",
            "detail": "Rider WebSocket connected."
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def driver_location(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_location",
            "lat": event["lat"],
            "lng": event["lng"],
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
        }))