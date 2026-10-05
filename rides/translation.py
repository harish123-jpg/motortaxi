from modeltranslation.translator import register, TranslationOptions

from .models import Ride, RideOffer, Rating


@register(Ride)
class RideTranslationOptions(TranslationOptions):
    fields = (
        "pickup_address",
        "drop_address",
        "cancel_reason",
    )


@register(RideOffer)
class RideOfferTranslationOptions(TranslationOptions):
    fields = ()


@register(Rating)
class RatingTranslationOptions(TranslationOptions):
    fields = (
        "review",
    )