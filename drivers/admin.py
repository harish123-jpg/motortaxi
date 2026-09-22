from django.contrib import admin
from modeltranslation.admin import TranslationAdmin

from .models import DriverDocument, DriverProfile


class DriverDocumentInline(admin.TabularInline):
    model = DriverDocument
    extra = 0


@admin.register(DriverProfile)
class DriverProfileAdmin(TranslationAdmin):
    list_display = (
        "id",
        "user",
        "license_number",
        "status",
        "verification_status",
        "rating_avg",
        "total_trips",
        "created_at",
    )
    list_filter = ("status", "verification_status")
    search_fields = ("user__full_name", "user__phone_number", "license_number")
    inlines = [DriverDocumentInline]
    actions = ["approve_drivers", "reject_drivers"]

    @admin.action(description="Approve selected drivers")
    def approve_drivers(self, request, queryset):
        updated = queryset.update(verification_status=DriverProfile.VerificationStatus.APPROVED)
        self.message_user(request, f"{updated} driver(s) approved.")

    @admin.action(description="Reject selected drivers")
    def reject_drivers(self, request, queryset):
        updated = queryset.update(verification_status=DriverProfile.VerificationStatus.REJECTED)
        self.message_user(request, f"{updated} driver(s) rejected.")


@admin.register(DriverDocument)
class DriverDocumentAdmin(TranslationAdmin):
    list_display = ("id", "driver", "document_type", "status", "uploaded_at")
    list_filter = ("document_type", "status")
    actions = ["approve_documents", "reject_documents"]

    @admin.action(description="Approve selected documents")
    def approve_documents(self, request, queryset):
        updated = queryset.update(status=DriverDocument.Status.APPROVED)
        self.message_user(request, f"{updated} document(s) approved.")

    @admin.action(description="Reject selected documents")
    def reject_documents(self, request, queryset):
        updated = queryset.update(status=DriverDocument.Status.REJECTED)
        self.message_user(request, f"{updated} document(s) rejected.")