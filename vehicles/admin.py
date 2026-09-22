from django.contrib import admin
from modeltranslation.admin import TranslationAdmin, TranslationTabularInline

from .models import Vehicle, VehicleDocument


class VehicleDocumentInline(TranslationTabularInline):
    model = VehicleDocument
    extra = 0


@admin.register(Vehicle)
class VehicleAdmin(TranslationAdmin):
    list_display = ("id", "plate_number", "vehicle_type", "driver", "color", "is_active")
    list_filter = ("vehicle_type", "is_active")
    search_fields = ("plate_number", "driver__user__full_name")
    inlines = [VehicleDocumentInline]


@admin.register(VehicleDocument)
class VehicleDocumentAdmin(TranslationAdmin):
    list_display = ("id", "vehicle", "document_type", "verification_status", "expiry_date")
    list_filter = ("document_type", "verification_status")
    actions = ["verify_documents", "reject_documents"]

    @admin.action(description="Verify selected documents")
    def verify_documents(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(
            verification_status=VehicleDocument.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )
        self.message_user(request, f"{updated} document(s) verified.")

    @admin.action(description="Reject selected documents")
    def reject_documents(self, request, queryset):
        updated = queryset.update(verification_status=VehicleDocument.VerificationStatus.REJECTED)
        self.message_user(request, f"{updated} document(s) rejected.")