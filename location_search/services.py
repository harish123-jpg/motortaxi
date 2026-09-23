"""
Location Search Service (LocationIQ)
--------------------------------------
Wraps LocationIQ API calls (Autocomplete/Search + Reverse Geocode).

Why LocationIQ (and not public Nominatim or Ola Maps)?
- App is GLOBAL, not India-only -> Ola Maps won't work (India-only).
- Public Nominatim rate-limits/blocks aggressively during testing ->
  not reliable even for a demo.
- LocationIQ is built on OpenStreetMap data (so response shape is very
  close to Nominatim) but runs on LocationIQ's own reliable
  infrastructure, with a real free tier and simple api_key auth.

Get your API key: https://locationiq.com (sign up -> dashboard -> token)

Why a service class?
- Sab LocationIQ-specific logic ek hi jagah rehta hai.
- Kal agar provider switch karna ho, sirf ye file badlegi -- views.py,
  urls.py, ya frontend contract kuch nahi badlega.
"""

import math

import requests

LOCATIONIQ_BASE_URL = "https://us1.locationiq.com/v1"
API_KEY = "pk.ce7837964601b53273715468aaf2a11c"  # <-- apni actual key yaha daalo (env var se lena better hai)
REQUEST_TIMEOUT = 10  # seconds
EARTH_RADIUS_KM = 6371.0


class LocationSearchService:
    """Single point of contact for all location/geocoding calls."""

    @staticmethod
    def search(query: str, limit: int = 5, country_code: str = None,
               ref_lat: float = None, ref_lon: float = None):
        """
        Text -> list of matching places (autocomplete-style search).

        Args:
            query: user typed text, e.g. "Sector 17 Chandigarh" or "Times Square"
            limit: max results to return
            country_code: optional ISO 2-letter code to bias results
                          (leave None for a truly global search)
            ref_lat, ref_lon: the "reference point" to measure distance
                          from. THIS CHANGES DEPENDING ON CONTEXT:
                            - Pickup search  -> pass the user's current
                              GPS location as ref_lat/ref_lon.
                            - Drop search    -> pass the already-selected
                              PICKUP location's lat/lon as ref_lat/ref_lon
                              (not the user's GPS).
                          Frontend decides what to send; this function
                          just measures distance from whatever point it
                          is given.

        Returns:
            List[dict]: cleaned place results, sorted nearest-first
                        when ref_lat/ref_lon are given
        """
        if not query or not query.strip():
            return []

        params = {
            "key": API_KEY,
            "q": query.strip(),
            "format": "json",
            "limit": limit,
            "addressdetails": 1,
        }
        if country_code:
            params["countrycodes"] = country_code

        response = requests.get(
            f"{LOCATIONIQ_BASE_URL}/search",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        raw_results = response.json()

        results = [LocationSearchService._clean_result(item) for item in raw_results]

        if ref_lat is not None and ref_lon is not None:
            for item in results:
                item["distance_km"] = LocationSearchService._haversine_distance(
                    ref_lat, ref_lon, item["lat"], item["lon"]
                )
            results.sort(key=lambda r: r["distance_km"])

        return results

    @staticmethod
    def _haversine_distance(lat1, lon1, lat2, lon2) -> float:
        """
        Straight-line distance (in km) between two lat/lon points.
        Pure math -- no external API call, so this is completely free
        and works for both pickup search and drop search alike.
        """
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
    def reverse_geocode(lat: float, lon: float):
        """
        lat/lon -> human-readable address.
        Useful for "use my current location" feature.

        Args:
            lat: latitude
            lon: longitude

        Returns:
            dict | None: cleaned place result, or None if nothing found
        """
        params = {
            "key": API_KEY,
            "lat": lat,
            "lon": lon,
            "format": "json",
            "addressdetails": 1,
        }

        response = requests.get(
            f"{LOCATIONIQ_BASE_URL}/reverse",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        if not data or "error" in data:
            return None

        return LocationSearchService._clean_result(data)

    @staticmethod
    def _clean_result(item: dict) -> dict:
        """LocationIQ ka raw JSON -> frontend ke liye clean shape."""
        return {
            "display_name": item.get("display_name", ""),
            "lat": float(item.get("lat", 0)),
            "lon": float(item.get("lon", 0)),
            "place_id": item.get("place_id"),
            "city": item.get("address", {}).get("city")
            or item.get("address", {}).get("town")
            or item.get("address", {}).get("village"),
            "state": item.get("address", {}).get("state"),
            "country": item.get("address", {}).get("country"),
        }