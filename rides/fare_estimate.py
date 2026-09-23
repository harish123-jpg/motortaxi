import math
from datetime import datetime

from vehicles.models import VehiclePricing

CURRENCY = "USD"
EARTH_RADIUS_KM = 6371.0
ASSUMED_AVG_SPEED_KMPH = 25


class FareEstimateService:

    @staticmethod
    def estimate(pickup_lat, pickup_lon, drop_lat, drop_lon):
        distance_km = FareEstimateService._haversine_distance(
            pickup_lat, pickup_lon, drop_lat, drop_lon
        )
        duration_min = FareEstimateService._estimate_duration(distance_km)
        current_hour = datetime.now().hour

        fares = [
            FareEstimateService._calculate_fare_breakdown(pricing, distance_km, current_hour)
            for pricing in VehiclePricing.objects.filter(is_active=True)
        ]

        return {
            "distance_km": distance_km,
            "duration_min": duration_min,
            "currency": CURRENCY,
            "fares": fares,
        }

    @staticmethod
    def _calculate_fare_breakdown(pricing, distance_km, current_hour):
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
    def _is_night_time(pricing, current_hour):
        if not pricing.night_pricing_enabled:
            return False
        start, end = pricing.night_start_hour, pricing.night_end_hour
        if start < end:
            return start <= current_hour < end
        return current_hour >= start or current_hour < end

    @staticmethod
    def _haversine_distance(lat1, lon1, lat2, lon2):
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
    def _estimate_duration(distance_km):
        hours = distance_km / ASSUMED_AVG_SPEED_KMPH
        return max(1, round(hours * 60))