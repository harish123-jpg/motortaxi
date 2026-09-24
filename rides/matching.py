from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

from drivers.models import DriverProfile
from .models import Ride


class DriverMatchingService:

    SEARCH_RADIUS_KM = 5.0

    @staticmethod
    def find_eligible_drivers(ride: Ride):
        pickup_point = Point(float(ride.pickup_lon), float(ride.pickup_lat), srid=4326)

        candidates = (
            DriverProfile.objects.filter(
                status=DriverProfile.Status.ONLINE,
                current_location__isnull=False,
                vehicles__vehicle_type=ride.vehicle_type,
                vehicles__is_active=True,
            )
            .annotate(distance=Distance("current_location", pickup_point))
            .filter(distance__lte=D(km=DriverMatchingService.SEARCH_RADIUS_KM))
            .order_by("distance")
            .distinct()
        )

        return list(candidates)