from rest_framework import serializers

from .models import Vehicle, VehicleDocument


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ("id", "vehicle_type", "make", "model", "plate_number", "color", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class VehicleDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleDocument
        fields = (
            "id",
            "document_type",
            "document_number",
            "document_file",
            "issue_date",
            "expiry_date",
            "verification_status",
            "rejection_reason",
            "verified_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "verification_status",
            "rejection_reason",
            "verified_at",
            "created_at",
            "updated_at",
        )


class BulkVehicleDocumentSerializer(serializers.Serializer):
    rc_file = serializers.FileField(required=False)
    rc_number = serializers.CharField(required=False, allow_blank=True)
    rc_issue_date = serializers.DateField(required=False, allow_null=True)
    rc_expiry_date = serializers.DateField(required=False, allow_null=True)

    insurance_file = serializers.FileField(required=False)
    insurance_number = serializers.CharField(required=False, allow_blank=True)
    insurance_issue_date = serializers.DateField(required=False, allow_null=True)
    insurance_expiry_date = serializers.DateField(required=False, allow_null=True)

    puc_file = serializers.FileField(required=False)
    puc_number = serializers.CharField(required=False, allow_blank=True)
    puc_issue_date = serializers.DateField(required=False, allow_null=True)
    puc_expiry_date = serializers.DateField(required=False, allow_null=True)

    permit_file = serializers.FileField(required=False)
    permit_number = serializers.CharField(required=False, allow_blank=True)
    permit_issue_date = serializers.DateField(required=False, allow_null=True)
    permit_expiry_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, data):
        has_any_file = any(
            data.get(f"{doc_type}_file") for doc_type in ("rc", "insurance", "puc", "permit")
        )
        if not has_any_file:
            raise serializers.ValidationError("At least one document file must be provided.")
        return data