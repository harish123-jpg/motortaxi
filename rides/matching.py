from rides.models import Ride
from drivers.models import DriverProfile
from .fare_estimate import FareEstimateService


class DriverMatchingService:

    SEARCH_RADIUS_KM = 5.0

    @staticmethod
    def find_eligible_drivers(ride: Ride):

        candidates = DriverProfile.objects.filter(
            is_online=True,
            is_busy=False,
            vehicles__vehicle_type=ride.vehicle_type,
            vehicles__is_active=True,
        ).distinct()

        eligible = []
        for driver in candidates:
            if driver.current_lat is None or driver.current_lon is None:
                continue

            distance = FareEstimateService._haversine_distance(
                float(ride.pickup_lat), float(ride.pickup_lon),
                float(driver.current_lat), float(driver.current_lon),
            )
            if distance <= DriverMatchingService.SEARCH_RADIUS_KM:
                eligible.append((driver, distance))

        eligible.sort(key=lambda x: x[1])
        return eligible