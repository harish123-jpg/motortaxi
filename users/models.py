from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

phone_regex = RegexValidator(
    regex=r'^\+[1-9]\d{7,14}$',
    message="Phone number must be in international format, e.g. +919876543210"
)


class User(AbstractUser):
    class Role(models.TextChoices):
        RIDER = "RIDER", _("Rider")
        DRIVER = "DRIVER", _("Driver")
        ADMIN = "ADMIN", _("Admin")

    class Gender(models.TextChoices):
        MALE = "MALE", _("Male")
        FEMALE = "FEMALE", _("Female")
        OTHER = "OTHER", _("Other")

    phone_number = models.CharField(max_length=17, unique=True, validators=[phone_regex])
    is_phone_verified = models.BooleanField(default=False)
    email = models.EmailField(blank=True, null=True)
    active_role = models.CharField(max_length=10, choices=Role.choices)

    full_name = models.CharField(max_length=100)
    profile_photo = models.ImageField(upload_to="profile_photos/", blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)

    address_line = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)

    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=15, blank=True, null=True)

    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        indexes = [
            models.Index(fields=["active_role"]),
            models.Index(fields=["phone_number"]),
        ]

    def __str__(self):
        return f"{self.full_name} - {self.phone_number} ({self.active_role})"

    @property
    def is_rider(self):
        return hasattr(self, "rider_profile")

    @property
    def is_driver(self):
        return hasattr(self, "driver_profile")


class RiderProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="rider_profile")
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    total_rides = models.PositiveIntegerField(default=0)

    home_address = models.CharField(max_length=255, blank=True, null=True)
    home_lat = models.FloatField(blank=True, null=True)
    home_lng = models.FloatField(blank=True, null=True)
    work_address = models.CharField(max_length=255, blank=True, null=True)
    work_lat = models.FloatField(blank=True, null=True)
    work_lng = models.FloatField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return self.user.full_name