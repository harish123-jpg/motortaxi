from django.db import models
from django.contrib.gis.db import models as gis_models
from django.utils.translation import gettext_lazy as _
from users.models import User


class DriverProfile(models.Model):
    class Status(models.TextChoices):
        ONLINE = "ONLINE", _("Online")
        OFFLINE = "OFFLINE", _("Offline")
        BUSY = "BUSY", _("Busy")
        ON_TRIP = "ON_TRIP", _("On Trip")

    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    license_number = models.CharField(max_length=30, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OFFLINE)
    verification_status = models.CharField(
        max_length=10, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    current_location = gis_models.PointField(geography=True, null=True, blank=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    total_trips = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["verification_status"]),
        ]

    def __str__(self):
        return f"{self.user.full_name} ({self.status})"

    def can_go_online(self):
        return self.verification_status == self.VerificationStatus.APPROVED

    def get_full_verification_status(self):
        if self.verification_status != self.VerificationStatus.APPROVED:
            return {
                "status": "DRIVER_DOCUMENTS_" + self.verification_status,
                "verified": False,
                "detail": "Driver documents not yet approved.",
            }

        vehicle = self.vehicles.filter(is_active=True).first()
        if not vehicle:
            return {
                "status": "VEHICLE_NOT_ADDED",
                "verified": False,
                "detail": "No active vehicle found. Please add a vehicle.",
            }

        vehicle_docs = vehicle.documents.all()
        if not vehicle_docs.exists():
            return {
                "status": "VEHICLE_DOCUMENTS_MISSING",
                "verified": False,
                "detail": "No documents uploaded for this vehicle.",
            }

        pending_docs = vehicle_docs.exclude(
            verification_status=vehicle_docs.model.VerificationStatus.VERIFIED
        )
        if pending_docs.exists():
            return {
                "status": "VEHICLE_DOCUMENTS_PENDING",
                "verified": False,
                "detail": f"{pending_docs.count()} vehicle document(s) not yet verified.",
            }

        return {
            "status": "APPROVED",
            "verified": True,
            "detail": "Driver is fully verified and ready to go online.",
        }

class DriverDocument(models.Model):
    class DocumentType(models.TextChoices):
        LICENSE = "LICENSE", _("License")
        RC = "RC", _("Registration Certificate")
        INSURANCE = "INSURANCE", _("Insurance")
        PHOTO = "PHOTO", _("Photo")

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")

    driver = models.ForeignKey(DriverProfile, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=15, choices=DocumentType.choices)
    file = models.FileField(upload_to="driver_documents/")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.CharField(max_length=255, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["driver"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["driver", "document_type"], name="unique_document_per_type")
        ]

    def __str__(self):
        return f"{self.driver_id} - {self.document_type}"