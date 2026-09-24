from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from vehicles.models import Vehicle


class Ride(models.Model):

    class Status(models.TextChoices):
        SEARCHING = "SEARCHING", _("Searching")
        ACCEPTED = "ACCEPTED", _("Accepted")
        ONGOING = "ONGOING", _("Ongoing")
        COMPLETED = "COMPLETED", _("Completed")
        CANCELLED = "CANCELLED", _("Cancelled")

    class CancelledBy(models.TextChoices):
        RIDER = "RIDER", _("Rider")
        DRIVER = "DRIVER", _("Driver")

    rider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rides",
        verbose_name=_("rider"),
    )

    driver = models.ForeignKey(
        "drivers.DriverProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_rides",
        verbose_name=_("driver"),
    )

    vehicle_type = models.CharField(
        max_length=10,
        choices=Vehicle.VehicleType.choices,
        verbose_name=_("vehicle type"),
    )

    pickup_lat = models.DecimalField(
        max_digits=9, decimal_places=6,
        verbose_name=_("pickup latitude"),
    )
    pickup_lon = models.DecimalField(
        max_digits=9, decimal_places=6,
        verbose_name=_("pickup longitude"),
    )
    pickup_address = models.CharField(
        max_length=255,
        verbose_name=_("pickup address"),
    )

    drop_lat = models.DecimalField(
        max_digits=9, decimal_places=6,
        verbose_name=_("drop latitude"),
    )
    drop_lon = models.DecimalField(
        max_digits=9, decimal_places=6,
        verbose_name=_("drop longitude"),
    )
    drop_address = models.CharField(
        max_length=255,
        verbose_name=_("drop address"),
    )

    distance_km = models.DecimalField(
        max_digits=8, decimal_places=2,
        verbose_name=_("distance (km)"),
    )
    estimated_fare = models.DecimalField(
        max_digits=10, decimal_places=2,
        verbose_name=_("estimated fare"),
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SEARCHING,
        verbose_name=_("status"),
    )

    cancelled_by = models.CharField(
        max_length=10,
        choices=CancelledBy.choices,
        blank=True,
        verbose_name=_("cancelled by"),
    )
    cancel_reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_("cancel reason"),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("created at"),
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_("updated at"),
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("Ride")
        verbose_name_plural = _("Rides")
        indexes = [
            models.Index(fields=["rider", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"Ride #{self.id} - {self.vehicle_type} - {self.status}"