"""
Location Search Views
----------------------
Two endpoints for the React Native app:
1. GET /api/location/search/?q=<text>          -> autocomplete suggestions
2. GET /api/location/reverse/?lat=..&lon=..     -> address from coordinates
"""

import requests
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import LocationSearchService


@api_view(["GET"])
def location_search(request):
    query = request.GET.get("q", "")
    limit = int(request.GET.get("limit", 5))

    # Reference point to measure distance from -- NOT always the user's
    # current GPS:
    #   - Pickup search -> frontend sends current GPS lat/lon here
    #   - Drop search   -> frontend sends the already-selected PICKUP
    #                      location's lat/lon here instead
    # Same endpoint handles both; frontend decides what to send.
    ref_lat = request.GET.get("lat")
    ref_lon = request.GET.get("lon")

    if not query or len(query.strip()) < 2:
        return Response(
            {"error": "Query param 'q' is required (min 2 characters)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        ref_lat = float(ref_lat) if ref_lat is not None else None
        ref_lon = float(ref_lon) if ref_lon is not None else None
    except ValueError:
        return Response(
            {"error": "'lat' and 'lon', if provided, must be valid numbers."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        results = LocationSearchService.search(
            query, limit=limit, ref_lat=ref_lat, ref_lon=ref_lon
        )
    except requests.RequestException as e:
        print("NOMINATIM ERROR:", repr(e))
        return Response(
            {"error": "Location service is temporarily unavailable. Try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"results": results}, status=status.HTTP_200_OK)


@api_view(["GET"])
def reverse_geocode(request):
    lat = request.GET.get("lat")
    lon = request.GET.get("lon")

    if not lat or not lon:
        return Response(
            {"error": "Both 'lat' and 'lon' query params are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return Response(
            {"error": "'lat' and 'lon' must be valid numbers."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = LocationSearchService.reverse_geocode(lat, lon)
    except requests.RequestException as e:
        print("NOMINATIM ERROR:", repr(e))
        return Response(
            {"error": "Location service is temporarily unavailable. Try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if result is None:
        return Response(
            {"error": "No address found for given coordinates."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({"result": result}, status=status.HTTP_200_OK)