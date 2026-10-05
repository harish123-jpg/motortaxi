from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from vehicles.models import Vehicle
from .models import Ride
from .ratings import rate_driver
from .serializers import RideSerializer
from .fare_estimate import FareEstimateService
from .matching import DriverMatchingService
from .notifications import create_and_notify_offers


class RidePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


@api_view(["POST"])
def fare_estimate(request):
    data = request.data
    required = ["pickup_lat", "pickup_lon", "drop_lat", "drop_lon"]
    missing = [f for f in required if f not in data]

    if missing:
        return Response({"error": f"Missing: {', '.join(missing)}"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        p_lat = float(data["pickup_lat"])
        p_lon = float(data["pickup_lon"])
        d_lat = float(data["drop_lat"])
        d_lon = float(data["drop_lon"])
    except (TypeError, ValueError):
        return Response({"error": "All lat/lon must be numbers."}, status=status.HTTP_400_BAD_REQUEST)

    result = FareEstimateService.estimate(p_lat, p_lon, d_lat, d_lon)

    customer_response = {
        "distance_km": result["distance_km"],
        "duration_min": result["duration_min"],
        "currency": result["currency"],
        "fares": [
            {
                "vehicle_type": f["vehicle_type"],
                "customer_fare": f["customer_fare"],
                "night_pricing_applied": f["night_pricing_applied"],
            }
            for f in result["fares"]
        ],
    }

    return Response(customer_response, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def book_ride(request):
    data = request.data
    required = ["pickup_lat", "pickup_lon", "pickup_address", "drop_lat", "drop_lon", "drop_address", "vehicle_type"]
    missing = [f for f in required if f not in data]

    if missing:
        return Response({"error": f"Missing: {', '.join(missing)}"}, status=status.HTTP_400_BAD_REQUEST)

    vehicle_type = data["vehicle_type"]

    if vehicle_type not in Vehicle.VehicleType.values:
        return Response(
            {"error": f"Invalid vehicle_type. Must be one of {Vehicle.VehicleType.values}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payment_method = data.get("payment_method", Ride.PaymentMethod.CASH)

    if payment_method not in Ride.PaymentMethod.values:
        return Response(
            {"error": f"Invalid payment_method. Must be one of {Ride.PaymentMethod.values}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        p_lat = float(data["pickup_lat"])
        p_lon = float(data["pickup_lon"])
        d_lat = float(data["drop_lat"])
        d_lon = float(data["drop_lon"])
    except (TypeError, ValueError):
        return Response({"error": "All lat/lon must be numbers."}, status=status.HTTP_400_BAD_REQUEST)

    estimate = FareEstimateService.estimate(p_lat, p_lon, d_lat, d_lon)

    matching_fare = next(
        (f for f in estimate["fares"] if f["vehicle_type"] == vehicle_type),
        None,
    )

    if matching_fare is None:
        return Response(
            {"error": f"No active pricing for vehicle_type '{vehicle_type}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ride = Ride.objects.create(
        rider=request.user,
        pickup_lat=p_lat,
        pickup_lon=p_lon,
        pickup_address=data["pickup_address"],
        drop_lat=d_lat,
        drop_lon=d_lon,
        drop_address=data["drop_address"],
        vehicle_type=vehicle_type,
        payment_method=payment_method,
        distance_km=estimate["distance_km"],
        estimated_fare=matching_fare["customer_fare"],
        driver_payout=matching_fare["driver_payout"],
        status=Ride.Status.SEARCHING,
    )

    eligible_drivers = DriverMatchingService.find_eligible_drivers(ride)

    if eligible_drivers:
        create_and_notify_offers(
            ride=ride,
            driver_payout=matching_fare["driver_payout"],
            currency=estimate["currency"],
            eligible_drivers=eligible_drivers,
        )

    return Response(
        {
            "ride_id": ride.id,
            "status": ride.status,
            "distance_km": ride.distance_km,
            "estimated_fare": ride.estimated_fare,
            "currency": estimate["currency"],
            "drivers_notified": len(eligible_drivers),
            "otp": ride.otp,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_rides(request):
    rides = Ride.objects.filter(rider=request.user).select_related("rider", "driver__user").order_by("-created_at")

    paginator = RidePagination()
    page = paginator.paginate_queryset(rides, request)

    serializer = RideSerializer(page, many=True, context={"request": request})

    return paginator.get_paginated_response(serializer.data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def driver_rides(request):
    if not hasattr(request.user, "driver_profile"):
        return Response({"detail": "Driver profile not found."}, status=status.HTTP_404_NOT_FOUND)

    driver_profile = request.user.driver_profile

    rides = Ride.objects.filter(driver=driver_profile).select_related("rider", "driver__user").order_by("-created_at")

    paginator = RidePagination()
    page = paginator.paginate_queryset(rides, request)

    serializer = RideSerializer(page, many=True, context={"request": request})

    return paginator.get_paginated_response(serializer.data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def active_ride(request):
    ride = (
        Ride.objects
        .filter(
            rider=request.user,
            status__in=[Ride.Status.SEARCHING, Ride.Status.ACCEPTED, Ride.Status.ONGOING],
        )
        .select_related("rider", "driver__user")
        .order_by("-created_at")
        .first()
    )

    if not ride:
        return Response({"active_ride": None})

    return Response({"active_ride": RideSerializer(ride, context={"request": request}).data})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def ride_detail(request, ride_id):
    ride = get_object_or_404(
        Ride.objects.select_related("rider", "driver__user"),
        id=ride_id,
        rider=request.user,
    )

    return Response(RideSerializer(ride, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def cancel_ride(request, ride_id):
    ride = get_object_or_404(
        Ride.objects.select_related("rider", "driver__user"),
        id=ride_id,
        rider=request.user,
    )

    if ride.status not in [Ride.Status.SEARCHING, Ride.Status.ACCEPTED]:
        return Response(
            {"error": f"Ride cannot be cancelled in '{ride.status}' state."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ride.status = Ride.Status.CANCELLED
    ride.cancelled_by = Ride.CancelledBy.RIDER
    ride.cancel_reason = request.data.get("reason", "")
    ride.save(update_fields=["status", "cancelled_by", "cancel_reason", "updated_at"])

    return Response(RideSerializer(ride, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def rate_ride(request, ride_id):
    stars = request.data.get("stars")
    review = request.data.get("review", "")

    try:
        stars = int(stars)
    except (TypeError, ValueError):
        return Response({"error": "stars must be an integer from 1 to 5."}, status=status.HTTP_400_BAD_REQUEST)

    result = rate_driver(ride_id, request.user, stars, review)

    if not result["success"]:
        return Response({"error": result["detail"]}, status=status.HTTP_400_BAD_REQUEST)

    rating = result["rating"]
    return Response(
        {
            "ride_id": rating.ride_id,
            "stars": rating.stars,
            "review": rating.review,
            "driver_new_rating_avg": float(rating.driver.rating_avg),
        },
        status=status.HTTP_201_CREATED,
    )
