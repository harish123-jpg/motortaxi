from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Ride


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def recent_drop_locations(request):
    try:
        limit = int(request.GET.get("limit", 10))
    except (TypeError, ValueError):
        limit = 10
    limit = max(1, min(limit, 50))

    rides = (
        Ride.objects.filter(rider=request.user, status=Ride.Status.COMPLETED)
        .order_by("-created_at")
        .values("id", "drop_lat", "drop_lon", "drop_address", "created_at")[:200]
    )

    seen = set()
    results = []
    for r in rides:
        address = (r["drop_address"] or "").strip()
        key = address.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        results.append({
            "ride_id": r["id"],
            "address": address,
            "lat": float(r["drop_lat"]),
            "lon": float(r["drop_lon"]),
            "last_used": r["created_at"],
        })
        if len(results) >= limit:
            break

    return Response({"results": results})