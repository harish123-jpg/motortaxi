from datetime import timedelta

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.utils import timezone

from drivers.models import DriverProfile, DriverSession
from .models import Ride


class DriverMatchingService:

    SEARCH_RADIUS_KM = 5.0
    ACTIVE_WINDOW = timedelta(minutes=2)

    @staticmethod
    def find_eligible_drivers(ride: Ride):
        pickup_point = Point(float(ride.pickup_lon), float(ride.pickup_lat), srid=4326)

        fresh_cutoff = timezone.now() - DriverMatchingService.ACTIVE_WINDOW
        fresh_driver_ids = DriverSession.objects.filter(
            ended_at__isnull=True,
            last_seen_at__gte=fresh_cutoff,
        ).values("driver_id")

        candidates = (
            DriverProfile.objects.filter(
                id__in=fresh_driver_ids,
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