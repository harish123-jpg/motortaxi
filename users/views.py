from django.db import IntegrityError, transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .country_codes import COUNTRY_CODES
from .models import RiderProfile, User
from .serializers import (
    RegisterSerializer,
    RiderProfileSerializer,
    SwitchRoleSerializer,
    UserSerializer,
    CountryCodeSerializer, CustomTokenObtainPairSerializer,
)


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "A user with this phone number already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise generics.ValidationError(
                {"detail": "Could not update profile due to a conflict. Please try again."}
            )


class RiderProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RiderProfileSerializer

    def get_object(self):
        profile, _ = RiderProfile.objects.get_or_create(user=self.request.user)
        return profile


class SwitchRoleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SwitchRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_role = serializer.validated_data["role"]
        user = request.user

        if user.active_role == target_role:
            return Response(
                {"detail": f"User is already in {target_role} role.", "active_role": target_role},
                status=status.HTTP_200_OK,
            )

        if target_role == User.Role.RIDER:
            RiderProfile.objects.get_or_create(user=user)

        elif target_role == User.Role.DRIVER:
            if not user.is_driver:
                return Response(
                    {
                        "detail": "Driver profile not found. Complete driver onboarding first.",
                        "verification_status": "NOT_STARTED",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user.active_role = target_role
        user.save(update_fields=["active_role", "updated_at"])
        return Response(UserSerializer(user).data)


class CountryCodeListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = CountryCodeSerializer(COUNTRY_CODES, many=True)
        return Response(serializer.data)

class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        user.delete()
        return Response(
            {"detail": "Account deleted successfully."},
            status=status.HTTP_200_OK,
        )