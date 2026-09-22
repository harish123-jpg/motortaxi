from rest_framework import serializers

from .models import DriverDocument, DriverProfile


class DriverProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverProfile
        fields = ("license_number",)


class DriverProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)

    class Meta:
        model = DriverProfile
        fields = (
            "id",
            "full_name",
            "phone_number",
            "license_number",
            "status",
            "verification_status",
            "rating_avg",
            "total_trips",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "verification_status",
            "rating_avg",
            "total_trips",
            "created_at",
            "updated_at",
        )


class DriverDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverDocument
        fields = ("id", "document_type", "file", "status", "rejection_reason", "uploaded_at")
        read_only_fields = ("id", "status", "rejection_reason", "uploaded_at")