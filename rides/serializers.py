from rest_framework import serializers

from .models import Ride


class RideSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ride
        fields = (
            "id",
            "driver",
            "vehicle_type",
            "pickup_lat",
            "pickup_lon",
            "pickup_address",
            "drop_lat",
            "drop_lon",
            "drop_address",
            "distance_km",
            "estimated_fare",
            "status",
            "cancelled_by",
            "cancel_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields