from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from vehicles.models import Vehicle
from .models import Ride
from .serializers import RideSerializer
from .services import FareEstimateService


# ---------------- FARE ESTIMATE (stateless) ----------------

@api_view(["POST"])
def fare_estimate(request):
    data = request.data
    required = ["pickup_lat", "pickup_lon", "drop_lat", "drop_lon"]
    missing = [f for f in required if f not in data]
    if missing:
        return Response({"error": f"Missing: {', '.join(missing)}"},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        p_lat = float(data["pickup_lat"]); p_lon = float(data["pickup_lon"])
        d_lat = float(data["drop_lat"]);   d_lon = float(data["drop_lon"])
    except (TypeError, ValueError):
        return Response({"error": "All lat/lon must be numbers."},
                        status=status.HTTP_400_BAD_REQUEST)

    result = FareEstimateService.estimate(p_lat, p_lon, d_lat, d_lon)
    return Response(result, status=status.HTTP_200_OK)


# ---------------- BOOK RIDE ----------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def book_ride(request):
    data = request.data
    required = ["pickup_lat", "pickup_lon", "pickup_address",
                "drop_lat", "drop_lon", "drop_address", "vehicle_type"]
    missing = [f for f in required if f not in data]
    if missing:
        return Response({"error": f"Missing: {', '.join(missing)}"},
                        status=status.HTTP_400_BAD_REQUEST)

    vehicle_type = data["vehicle_type"]
    if vehicle_type not in Vehicle.VehicleType.values:
        return Response(
            {"error": f"Invalid vehicle_type. Must be one of {Vehicle.VehicleType.values}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        p_lat = float(data["pickup_lat"]); p_lon = float(data["pickup_lon"])
        d_lat = float(data["drop_lat"]);   d_lon = float(data["drop_lon"])
    except (TypeError, ValueError):
        return Response({"error": "All lat/lon must be numbers."},
                        status=status.HTTP_400_BAD_REQUEST)

    estimate = FareEstimateService.estimate(p_lat, p_lon, d_lat, d_lon)
    matching_fare = next(
        (f for f in estimate["fares"] if f["vehicle_type"] == vehicle_type), None
    )
    if matching_fare is None:
        return Response(
            {"error": f"No active pricing for vehicle_type '{vehicle_type}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ride = Ride.objects.create(
        rider=request.user,
        pickup_lat=p_lat, pickup_lon=p_lon, pickup_address=data["pickup_address"],
        drop_lat=d_lat,   drop_lon=d_lon,   drop_address=data["drop_address"],
        vehicle_type=vehicle_type,
        distance_km=estimate["distance_km"],
        estimated_fare=matching_fare["customer_fare"],
        status=Ride.Status.SEARCHING,
    )

    return Response(
        {
            "ride_id": ride.id,
            "status": ride.status,
            "distance_km": ride.distance_km,
            "estimated_fare": ride.estimated_fare,
            "currency": estimate["currency"],
        },
        status=status.HTTP_201_CREATED,
    )


# ---------------- RIDER SIDE ----------------

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_rides(request):
    rides = Ride.objects.filter(rider=request.user)
    return Response(RideSerializer(rides, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def active_ride(request):
    ride = (
        Ride.objects
        .filter(
            rider=request.user,
            status__in=[Ride.Status.SEARCHING, Ride.Status.ACCEPTED, Ride.Status.ONGOING],
        )
        .order_by("-created_at")
        .first()
    )
    if not ride:
        return Response({"active_ride": None})
    return Response({"active_ride": RideSerializer(ride).data})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def ride_detail(request, ride_id):
    ride = get_object_or_404(Ride, id=ride_id, rider=request.user)
    return Response(RideSerializer(ride).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def cancel_ride(request, ride_id):
    ride = get_object_or_404(Ride, id=ride_id, rider=request.user)

    if ride.status not in [Ride.Status.SEARCHING, Ride.Status.ACCEPTED]:
        return Response(
            {"error": f"Ride cannot be cancelled in '{ride.status}' state."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ride.status = Ride.Status.CANCELLED
    ride.cancelled_by = Ride.CancelledBy.RIDER
    ride.cancel_reason = request.data.get("reason", "")
    ride.save()

    return Response(RideSerializer(ride).data)