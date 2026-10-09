from django.contrib import admin

from .models import Rating, Ride, RideOffer


class RideOfferInline(admin.TabularInline):
    model = RideOffer
    extra = 0
    readonly_fields = ("driver", "status", "sent_at", "responded_at")
    can_delete = False


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = (
        "id", "rider", "driver", "vehicle_type",
        "status", "estimated_fare", "cancelled_by", "created_at",
    )
    list_filter = ("status", "vehicle_type", "cancelled_by", "created_at")
    search_fields = (
        "id",
        "rider__username",
        "rider__phone_number",
        "driver__user__phone_number",
        "pickup_address",
        "drop_address",
    )
    readonly_fields = ("otp", "created_at", "updated_at")
    list_select_related = ("rider", "driver__user")
    inlines = [RideOfferInline]


@admin.register(RideOffer)
class RideOfferAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "driver", "status", "sent_at", "responded_at")
    list_filter = ("status",)
    list_select_related = ("ride", "driver__user")


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "rider", "driver", "stars", "created_at")
    list_filter = ("stars",)
    list_select_related = ("ride", "rider", "driver__user")