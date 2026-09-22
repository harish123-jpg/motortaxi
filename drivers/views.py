from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DriverDocument, DriverProfile
from .permissions import IsDriver
from .serializers import DriverDocumentSerializer, DriverProfileCreateSerializer, DriverProfileSerializer


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
        if verification != "APPROVED":
            return Response(
                {
                    "detail": "Driver is not fully verified yet.",
                    "verification_status": verification,
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

        profile.status = DriverProfile.Status.OFFLINE
        profile.save(update_fields=["status", "updated_at"])
        return Response(DriverProfileSerializer(profile).data)