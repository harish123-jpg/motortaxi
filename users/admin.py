from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from modeltranslation.admin import TranslationAdmin

from .models import RiderProfile, User


@admin.register(User)
class UserAdmin(TranslationAdmin, BaseUserAdmin):
    list_display = ("id", "full_name", "phone_number", "email", "active_role", "is_active", "is_phone_verified", "date_joined")
    list_filter = ("active_role", "is_active", "is_phone_verified", "gender")
    search_fields = ("full_name", "phone_number", "email", "username")
    ordering = ("-date_joined",)

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Identity", {"fields": ("phone_number", "email", "active_role", "is_phone_verified")}),
        ("Personal Info", {"fields": ("full_name", "profile_photo", "date_of_birth", "gender")}),
        ("Address", {"fields": ("address_line", "city", "state", "pincode")}),
        ("Emergency Contact", {"fields": ("emergency_contact_name", "emergency_contact_phone")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important Dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "phone_number", "active_role", "full_name", "password1", "password2"),
        }),
    )


@admin.register(RiderProfile)
class RiderProfileAdmin(TranslationAdmin):
    list_display = ("id", "user", "rating_avg", "total_rides", "created_at")
    search_fields = ("user__full_name", "user__phone_number")
    list_filter = ("rating_avg",)