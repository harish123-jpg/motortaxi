from modeltranslation.translator import register, TranslationOptions
from .models import User, RiderProfile


@register(User)
class UserTranslationOptions(TranslationOptions):
    fields = (
        'full_name',
        'address_line',
        'city',
        'state',
        'pincode',
        'emergency_contact_name',
    )


@register(RiderProfile)
class RiderProfileTranslationOptions(TranslationOptions):
    fields = (
        'home_address',
        'work_address',
    )