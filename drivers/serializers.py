from rest_framework import serializers
from .models import DriverWallet, WalletTransaction,DriverDocument, DriverProfile


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


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ["id", "ride_id", "transaction_type", "reason", "amount", "balance_after", "created_at"]


class DriverWalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverWallet
        fields = ["balance", "updated_at"]