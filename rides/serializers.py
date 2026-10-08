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
            "driver_payout",
            "final_fare",
            "payment_method",
            "payment_status",
            "otp",
            "status",
            "arrived_at",
            "started_at",
            "completed_at",
            "cancelled_by",
            "cancel_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DriverRideSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ride
        fields = (
            "id",
            "vehicle_type",
            "pickup_lat",
            "pickup_lon",
            "pickup_address",
            "drop_lat",
            "drop_lon",
            "drop_address",
            "distance_km",
            "estimated_fare",
            "driver_payout",
            "final_fare",
            "payment_method",
            "payment_status",
            "status",
            "arrived_at",
            "started_at",
            "completed_at",
            "cancelled_by",
            "cancel_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields