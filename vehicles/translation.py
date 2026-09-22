from modeltranslation.translator import register, TranslationOptions
from .models import Vehicle, VehicleDocument


@register(Vehicle)
class VehicleTranslationOptions(TranslationOptions):
    fields = (
        'make',
        'model',
        'plate_number',
        'color',
    )


@register(VehicleDocument)
class VehicleDocumentTranslationOptions(TranslationOptions):
    fields = (
        'document_number',
        'rejection_reason',
    )