from django.db import IntegrityError
from django.db.models import Avg

from .models import Ride, Rating


def rate_driver(ride_id, rider, stars, review=""):
    try:
        ride = Ride.objects.select_related("driver").get(id=ride_id, rider=rider)
    except Ride.DoesNotExist:
        return {"success": False, "detail": "Ride not found."}

    if ride.status != Ride.Status.COMPLETED:
        return {"success": False, "detail": "You can only rate a completed ride."}

    if ride.driver_id is None:
        return {"success": False, "detail": "This ride has no driver on record."}

    if not isinstance(stars, int) or not (1 <= stars <= 5):
        return {"success": False, "detail": "stars must be an integer from 1 to 5."}

    try:
        rating = Rating.objects.create(
            ride=ride,
            rider=rider,
            driver=ride.driver,
            stars=stars,
            review=review,
        )
    except IntegrityError:
        return {"success": False, "detail": "This ride has already been rated."}

    _recalculate_driver_rating(ride.driver)

    return {"success": True, "detail": "Rating submitted.", "rating": rating}


def _recalculate_driver_rating(driver_profile):
    avg = Rating.objects.filter(driver=driver_profile).aggregate(avg=Avg("stars"))["avg"]
    driver_profile.rating_avg = round(avg or 5.0, 2)
    driver_profile.save(update_fields=["rating_avg", "updated_at"])