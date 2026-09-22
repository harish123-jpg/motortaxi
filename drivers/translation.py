from modeltranslation.translator import register, TranslationOptions
from .models import DriverProfile, DriverDocument


@register(DriverProfile)
class DriverProfileTranslationOptions(TranslationOptions):
    fields = (
        'license_number',
    )


@register(DriverDocument)
class DriverDocumentTranslationOptions(TranslationOptions):
    fields = (
        'rejection_reason',
    )