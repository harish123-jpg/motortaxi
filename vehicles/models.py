from django.db import models
from django.utils.translation import gettext_lazy as _

from drivers.models import DriverProfile


class Vehicle(models.Model):

    class VehicleType(models.TextChoices):
        CAR = "CAR", _("Car")
        BIKE = "BIKE", _("Bike")
        AUTO = "AUTO", _("Auto")

    driver = models.ForeignKey(
        DriverProfile,
        on_delete=models.CASCADE,
        related_name="vehicles",
    )

    vehicle_type = models.CharField(
        max_length=10,
        choices=VehicleType.choices,
    )

    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)

    plate_number = models.CharField(
        max_length=20,
        unique=True,
    )

    color = models.CharField(max_length=30)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["vehicle_type"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.plate_number} ({self.vehicle_type})"


class VehicleDocument(models.Model):

    class DocumentType(models.TextChoices):
        RC = "RC", _("Registration Certificate")
        INSURANCE = "INSURANCE", _("Insurance")
        PUC = "PUC", _("Pollution Certificate")
        PERMIT = "PERMIT", _("Permit")

    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        VERIFIED = "VERIFIED", _("Verified")
        REJECTED = "REJECTED", _("Rejected")

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
    )

    document_number = models.CharField(
        max_length=100,
        blank=True,
    )

    document_file = models.FileField(
        upload_to="vehicle_documents/",
    )

    issue_date = models.DateField(
        blank=True,
        null=True,
    )

    expiry_date = models.DateField(
        blank=True,
        null=True,
    )

    verification_status = models.CharField(
        max_length=10,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )

    rejection_reason = models.TextField(
        blank=True,
    )

    verified_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["vehicle", "document_type"],
                name="unique_vehicle_document_type",
            ),
        ]

        indexes = [
            models.Index(fields=["verification_status"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.vehicle.plate_number} - {self.document_type}"


class VehiclePricing(models.Model):

    vehicle_type = models.CharField(
        max_length=10,
        choices=Vehicle.VehicleType.choices,
        unique=True,
    )

    base_fare = models.DecimalField(max_digits=6, decimal_places=2)
    per_km_rate = models.DecimalField(max_digits=6, decimal_places=2)
    minimum_fare = models.DecimalField(max_digits=6, decimal_places=2)

    platform_commission_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=20.0,
    )

    night_pricing_enabled = models.BooleanField(default=False)
    night_start_hour = models.PositiveSmallIntegerField(default=23)
    night_end_hour = models.PositiveSmallIntegerField(default=5)
    night_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.5)

    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vehicle Pricing"
        verbose_name_plural = "Vehicle Pricing"

    def __str__(self):
        return self.vehicle_type