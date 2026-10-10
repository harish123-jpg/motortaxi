import random

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from vehicles.models import Vehicle


def generate_otp():
    return str(random.randint(1000, 9999))


class Ride(models.Model):

    class Status(models.TextChoices):
        SEARCHING = "SEARCHING", _("Searching")
        ACCEPTED = "ACCEPTED", _("Accepted")
        ONGOING = "ONGOING", _("Ongoing")
        COMPLETED = "COMPLETED", _("Completed")
        CANCELLED = "CANCELLED", _("Cancelled")

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", _("Cash")
        UPI = "UPI", _("UPI")
        CARD = "CARD", _("Card")
        MOBILE_MONEY = "MOBILE_MONEY", _("Mobile Money")

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        PAID = "PAID", _("Paid")
        FAILED = "FAILED", _("Failed")

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

    driver_payout = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name=_("driver payout (locked at booking time)"),
    )

    final_fare = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name=_("final fare"),
    )

    payment_method = models.CharField(
        max_length=15,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
        verbose_name=_("payment method"),
    )

    payment_status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        verbose_name=_("payment status"),
    )

    payment_details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_("payment details"),
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SEARCHING,
        verbose_name=_("status"),
    )

    otp = models.CharField(
        max_length=4,
        default=generate_otp,
        verbose_name=_("start trip otp"),
    )

    arrived_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name=_("driver arrived at"),
    )
    started_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name=_("trip started at"),
    )
    completed_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name=_("trip completed at"),
    )

    notified_driver_user_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_("notified driver user ids"),
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
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"Ride #{self.id} - {self.vehicle_type} - {self.status}"


class RideOffer(models.Model):

    class Status(models.TextChoices):
        SENT = "SENT", _("Sent")
        ACCEPTED = "ACCEPTED", _("Accepted")
        REJECTED = "REJECTED", _("Rejected")
        EXPIRED = "EXPIRED", _("Expired")

    ride = models.ForeignKey(
        Ride,
        on_delete=models.CASCADE,
        related_name="offers",
        verbose_name=_("ride"),
    )

    driver = models.ForeignKey(
        "drivers.DriverProfile",
        on_delete=models.CASCADE,
        related_name="ride_offers",
        verbose_name=_("driver"),
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.SENT,
        verbose_name=_("status"),
    )

    sent_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-sent_at"]
        verbose_name = _("Ride Offer")
        verbose_name_plural = _("Ride Offers")
        indexes = [
            models.Index(fields=["ride", "status"]),
            models.Index(fields=["driver", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["ride", "driver"],
                name="unique_ride_offer_per_driver",
            ),
        ]

    def __str__(self):
        return f"Offer: Ride #{self.ride_id} -> Driver {self.driver_id} ({self.status})"


class Rating(models.Model):
    ride = models.OneToOneField(
        Ride,
        on_delete=models.CASCADE,
        related_name="rating",
        verbose_name=_("ride"),
    )

    rider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings_given",
        verbose_name=_("rider"),
    )

    driver = models.ForeignKey(
        "drivers.DriverProfile",
        on_delete=models.CASCADE,
        related_name="ratings_received",
        verbose_name=_("driver"),
    )

    stars = models.PositiveSmallIntegerField(
        verbose_name=_("stars")
    )

    review = models.TextField(
        blank=True,
        verbose_name=_("review")
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("Rating")
        verbose_name_plural = _("Ratings")

        constraints = [
            models.CheckConstraint(
                condition=models.Q(stars__gte=1) & models.Q(stars__lte=5),
                name="rating_stars_between_1_and_5",
            ),
        ]

        indexes = [
            models.Index(fields=["driver"]),
        ]

    def __str__(self):
        return f"Ride #{self.ride_id}: {self.stars} stars"