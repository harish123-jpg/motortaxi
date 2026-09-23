from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from modeltranslation.admin import TranslationAdmin

from rides.models import Ride
from .models import RiderProfile, User


# ---------------- Inline: user ki rides (read-only) ----------------
class RideInline(admin.TabularInline):
    model = Ride
    fk_name = "rider"
    extra = 0
    can_delete = False
    show_change_link = True

    fields = (
        "id", "vehicle_type", "status",
        "pickup_address", "drop_address",
        "estimated_fare", "created_at",
    )
    readonly_fields = fields
    ordering = ("-created_at",)

    verbose_name = _("Ride")
    verbose_name_plural = _("Rides")

    def has_add_permission(self, request, obj=None):
        return False


# ---------------- User admin ----------------
@admin.register(User)
class UserAdmin(TranslationAdmin, BaseUserAdmin):

    list_display = (
        "id", "full_name", "phone_number", "email",
        "active_role", "is_active", "is_phone_verified", "date_joined",
    )
    list_filter = ("active_role", "is_active", "is_phone_verified", "gender")
    search_fields = ("full_name", "phone_number", "email", "username")
    ordering = ("-date_joined",)
    list_per_page = 50

    inlines = [RideInline]

    fieldsets = (
        (_("Login Info"), {
            "fields": ("username", "password"),
        }),
        (_("Identity"), {
            "fields": ("phone_number", "email", "active_role", "is_phone_verified"),
        }),
        (_("Personal Info"), {
            "fields": ("full_name", "profile_photo", "date_of_birth", "gender"),
        }),
        (_("Address"), {
            "fields": ("address_line", "city", "state", "pincode"),
            "classes": ("collapse",),
        }),
        (_("Emergency Contact"), {
            "fields": ("emergency_contact_name", "emergency_contact_phone"),
            "classes": ("collapse",),
        }),
        (_("Permissions"), {
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
            "classes": ("collapse",),
        }),
        (_("Important Dates"), {
            "fields": ("last_login", "date_joined"),
            "classes": ("collapse",),
        }),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "username", "phone_number", "active_role",
                "full_name", "password1", "password2",
            ),
        }),
    )


# ---------------- Rider profile admin ----------------
@admin.register(RiderProfile)
class RiderProfileAdmin(TranslationAdmin):

    list_display = (
        "id", "user", "rating_avg", "total_rides", "created_at",
    )
    search_fields = ("user__full_name", "user__phone_number")
    list_filter = ("rating_avg",)
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")