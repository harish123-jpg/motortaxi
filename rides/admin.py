from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from .models import Ride


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = (
        "id", "rider", "driver", "vehicle_type",
        "status", "estimated_fare", "created_at",
    )
    list_filter = ("status", "vehicle_type", "created_at")
    search_fields = ("id", "rider__username", "pickup_address", "drop_address")
    readonly_fields = ("created_at", "updated_at")