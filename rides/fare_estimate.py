"""
Fare Estimate Service
-----------------------
Given pickup + drop lat/lon, calculates for each ACTIVE vehicle type
(read from the VehiclePricing table -- not hardcoded, since rates
change over time and are edited via Django Admin):

1. Distance (Haversine formula -- straight-line, no external API needed)
2. Duration estimate (rough, based on assumed average speed)
3. Fare the CUSTOMER pays (with night multiplier applied if applicable)
4. Platform commission (app's cut)
5. Driver payout (what the driver actually earns)

NOTE: Straight-line distance is an MVP/demo simplification, not actual
road distance. Swap in a routing API later (OSRM/Google Directions) by
editing _haversine_distance's caller, not the pricing logic.
"""

import math
from datetime import datetime

from vehicles.models import VehiclePricing

CURRENCY = "USD"
EARTH_RADIUS_KM = 6371.0
ASSUMED_AVG_SPEED_KMPH = 25


class FareEstimateService:
    """Single point of contact for distance + fare + payout calculation."""

    @staticmethod
    def estimate(pickup_lat, pickup_lon, drop_lat, drop_lon):
        """
        Returns a dict with distance_km, duration_min, currency, and a
        fare breakdown (customer fare, platform commission, driver
        payout) for every active vehicle type in the DB.
        """
        distance_km = FareEstimateService._haversine_distance(
            pickup_lat, pickup_lon, drop_lat, drop_lon
        )
        duration_min = FareEstimateService._estimate_duration(distance_km)

        current_hour = datetime.now().hour
        fares = []

        for pricing in VehiclePricing.objects.filter(is_active=True):
            fares.append(
                FareEstimateService._calculate_fare_breakdown(pricing, distance_km, current_hour)
            )

        return {
            "distance_km": distance_km,
            "duration_min": duration_min,
            "currency": CURRENCY,
            "fares": fares,
        }

    @staticmethod
    def _calculate_fare_breakdown(pricing: VehiclePricing, distance_km: float, current_hour: int) -> dict:
        raw_fare = float(pricing.base_fare) + (float(pricing.per_km_rate) * distance_km)
        customer_fare = max(raw_fare, float(pricing.minimum_fare))

        is_night = FareEstimateService._is_night_time(pricing, current_hour)
        if is_night:
            customer_fare *= float(pricing.night_multiplier)

        commission_percent = float(pricing.platform_commission_percent)
        platform_commission = customer_fare * (commission_percent / 100)
        driver_payout = customer_fare - platform_commission

        return {
            "vehicle_type": pricing.vehicle_type,
            "customer_fare": round(customer_fare, 2),
            "platform_commission": round(platform_commission, 2),
            "driver_payout": round(driver_payout, 2),
            "night_pricing_applied": is_night,
        }

    @staticmethod
    def _is_night_time(pricing: VehiclePricing, current_hour: int) -> bool:
        if not pricing.night_pricing_enabled:
            return False

        start, end = pricing.night_start_hour, pricing.night_end_hour
        if start < end:
            # e.g. start=1, end=5 -> night is 1 AM to 5 AM
            return start <= current_hour < end
        else:
            # e.g. start=23, end=5 -> night wraps past midnight
            return current_hour >= start or current_hour < end

    @staticmethod
    def _haversine_distance(lat1, lon1, lat2, lon2) -> float:
        """Straight-line distance (in km) between two lat/lon points."""
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(d_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return round(EARTH_RADIUS_KM * c, 2)

    @staticmethod
    def _estimate_duration(distance_km: float) -> int:
        """Rough duration in minutes, based on assumed average speed."""
        hours = distance_km / ASSUMED_AVG_SPEED_KMPH
        return max(1, round(hours * 60))