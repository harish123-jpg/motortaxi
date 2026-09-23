from rest_framework import serializers

from .models import Ride


class RideSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            "id", "status", "vehicle_type",
            "pickup_lat", "pickup_lon", "pickup_address",
            "drop_lat", "drop_lon", "drop_address",
            "distance_km", "estimated_fare",
            "driver_name",
            "cancelled_by", "cancel_reason",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_driver_name(self, obj):
        if not obj.driver:
            return None
        user = getattr(obj.driver, "user", None)
        if user:
            return user.get_full_name() or user.username
        return None