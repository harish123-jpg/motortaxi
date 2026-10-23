import math
from datetime import datetime
from zoneinfo import ZoneInfo

from vehicles.models import VehiclePricing

CURRENCY = "XAF"
CURRENCY_SYMBOL = "FCFA"
LOCAL_TIMEZONE = ZoneInfo("Africa/Douala")
EARTH_RADIUS_KM = 6371.0
ASSUMED_AVG_SPEED_KMPH = 25
ROUNDING_STEP = 1


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

        current_hour = datetime.now(LOCAL_TIMEZONE).hour
        fares = []

        for pricing in VehiclePricing.objects.filter(is_active=True):
            fares.append(
                FareEstimateService._calculate_fare_breakdown(pricing, distance_km, current_hour)
            )

        return {
            "distance_km": distance_km,
            "duration_min": duration_min,
            "currency": CURRENCY,
            "currency_symbol": CURRENCY_SYMBOL,
            "fares": fares,
        }

    @staticmethod
    def _calculate_fare_breakdown(pricing: VehiclePricing, distance_km: float, current_hour: int) -> dict:
        raw_fare = float(pricing.base_fare) + (float(pricing.per_km_rate) * distance_km)
        customer_fare = max(raw_fare, float(pricing.minimum_fare))

        is_night = FareEstimateService._is_night_time(pricing, current_hour)
        if is_night:
            customer_fare *= float(pricing.night_multiplier)

        # XAF has no decimals: round to whole francs (or to ROUNDING_STEP)
        customer_fare = FareEstimateService._round_xaf(customer_fare)

        commission_percent = float(pricing.platform_commission_percent)
        platform_commission = int(round(customer_fare * commission_percent / 100))
        driver_payout = customer_fare - platform_commission  # always adds up exactly

        return {
            "vehicle_type": pricing.vehicle_type,
            "customer_fare": customer_fare,
            "platform_commission": platform_commission,
            "driver_payout": driver_payout,
            "night_pricing_applied": is_night,
        }

    @staticmethod
    def _round_xaf(amount: float) -> int:
        """Round to a whole number of francs, or to the nearest ROUNDING_STEP."""
        return int(round(amount / ROUNDING_STEP) * ROUNDING_STEP)

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