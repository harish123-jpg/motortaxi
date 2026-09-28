from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.gis.geos import Point

from .models import DriverDocument, DriverProfile, DriverWallet
from .permissions import IsDriver
from .serializers import (
    DriverDocumentSerializer,
    DriverProfileCreateSerializer,
    DriverProfileSerializer,
    DriverWalletSerializer,
    WalletTransactionSerializer,
)
from .wallet import get_earnings_summary


class DriverProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, "driver_profile"):
            return Response(
                {"detail": "Driver profile not found. Please complete onboarding first."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(DriverProfileSerializer(request.user.driver_profile).data)

    def post(self, request):
        if hasattr(request.user, "driver_profile"):
            return Response(
                {"detail": "Driver profile already exists for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DriverProfileCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                profile = serializer.save(user=request.user)
        except IntegrityError as e:
            if "license_number" in str(e).lower():
                return Response(
                    {"detail": "A driver with this license number already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if "user_id" in str(e).lower() or "driver_profile" in str(e).lower():
                return Response(
                    {"detail": "Driver profile already exists for this account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"detail": "Could not create driver profile due to a conflict. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(DriverProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        if not hasattr(request.user, "driver_profile"):
            return Response(
                {"detail": "Driver profile not found. Please complete onboarding first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        profile = request.user.driver_profile
        serializer = DriverProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "A driver with this license number already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(serializer.data)


class DriverDocumentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DriverDocumentSerializer

    def get_queryset(self):
        return DriverDocument.objects.filter(driver__user=self.request.user)

    def perform_create(self, serializer):
        if not hasattr(self.request.user, "driver_profile"):
            raise generics.ValidationError(
                {"detail": "Driver profile not found. Please complete onboarding first."}
            )

        profile = self.request.user.driver_profile

        try:
            serializer.save(driver=profile)
        except IntegrityError:
            raise generics.ValidationError(
                {"detail": "A document of this type already exists for this driver. Use update instead."}
            )


class GoOnlineView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def post(self, request):
        if not hasattr(request.user, "driver_profile"):
            return Response(
                {"detail": "Driver profile not found. Please complete onboarding first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        profile = request.user.driver_profile

        if profile.status == DriverProfile.Status.ONLINE:
            return Response(
                {"detail": "Driver is already online.", "status": profile.status},
                status=status.HTTP_200_OK,
            )

        verification = profile.get_full_verification_status()
        if not verification["verified"]:
            return Response(
                {
                    "detail": verification["detail"],
                    "verification_status": verification["status"],
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        profile.status = DriverProfile.Status.ONLINE
        profile.save(update_fields=["status", "updated_at"])
        return Response(DriverProfileSerializer(profile).data)


class GoOfflineView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def post(self, request):
        if not hasattr(request.user, "driver_profile"):
            return Response(
                {"detail": "Driver profile not found. Please complete onboarding first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        profile = request.user.driver_profile

        if profile.status == DriverProfile.Status.OFFLINE:
            return Response(
                {"detail": "Driver is already offline.", "status": profile.status},
                status=status.HTTP_200_OK,
            )

        if profile.status == DriverProfile.Status.ON_TRIP:
            return Response(
                {"detail": "Cannot go offline while on an active trip."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.status = DriverProfile.Status.OFFLINE
        profile.save(update_fields=["status", "updated_at"])
        return Response(DriverProfileSerializer(profile).data)


class UpdateLocationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def post(self, request):
        if not hasattr(request.user, "driver_profile"):
            return Response(
                {"detail": "Driver profile not found. Please complete onboarding first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        lat = request.data.get("lat")
        lng = request.data.get("lng")

        if lat is None or lng is None:
            return Response(
                {"detail": "lat and lng are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat = float(lat)
            lng = float(lng)
        except (TypeError, ValueError):
            return Response(
                {"detail": "lat and lng must be valid numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return Response(
                {"detail": "lat/lng out of valid range."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = request.user.driver_profile
        profile.current_location = Point(lng, lat, srid=4326)
        profile.save(update_fields=["current_location", "updated_at"])

        return Response(
            {"detail": "Location updated.", "lat": lat, "lng": lng}
        )


# ---------------- WALLET ----------------

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def wallet_balance(request):
    profile = get_object_or_404(DriverProfile, user=request.user)
    wallet, _ = DriverWallet.objects.get_or_create(driver=profile)
    return Response(DriverWalletSerializer(wallet).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def wallet_transactions(request):
    profile = get_object_or_404(DriverProfile, user=request.user)
    wallet, _ = DriverWallet.objects.get_or_create(driver=profile)
    transactions = wallet.transactions.all()[:100]
    return Response(WalletTransactionSerializer(transactions, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def wallet_summary(request):
    profile = get_object_or_404(DriverProfile, user=request.user)
    summary = get_earnings_summary(profile)
    return Response(summary)