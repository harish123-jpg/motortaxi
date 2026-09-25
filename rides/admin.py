from django.contrib import admin

from .models import Ride, RideOffer


class RideOfferInline(admin.TabularInline):
    model = RideOffer
    extra = 0
    readonly_fields = ("driver", "status", "sent_at", "responded_at")


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = (
        "id", "rider", "driver", "vehicle_type",
        "status", "estimated_fare", "created_at",
    )
    list_filter = ("status", "vehicle_type", "created_at")
    search_fields = ("id", "rider__username", "pickup_address", "drop_address")
    readonly_fields = ("created_at", "updated_at")
    inlines = [RideOfferInline]


@admin.register(RideOffer)
class RideOfferAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "driver", "status", "sent_at", "responded_at")
    list_filter = ("status",)