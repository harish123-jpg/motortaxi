from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import RiderProfile, User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=[User.Role.RIDER, User.Role.DRIVER], write_only=True)

    class Meta:
        model = User
        fields = ("phone_number", "email", "password", "role", "full_name")

    def validate_phone_number(self, value):
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        role = validated_data.pop("role")

        user = User(
            username=validated_data["phone_number"],
            active_role=role,
            **validated_data,
        )
        user.set_password(password)
        user.save()

        if role == User.Role.RIDER:
            RiderProfile.objects.create(user=user)

        return user


class UserSerializer(serializers.ModelSerializer):
    is_rider = serializers.BooleanField(read_only=True)
    is_driver = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "phone_number",
            "email",
            "active_role",
            "is_rider",
            "is_driver",
            "is_active",
            "is_phone_verified",
            "full_name",
            "profile_photo",
            "date_of_birth",
            "gender",
            "address_line",
            "city",
            "state",
            "pincode",
            "emergency_contact_name",
            "emergency_contact_phone",
            "date_joined",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "phone_number",
            "active_role",
            "is_rider",
            "is_driver",
            "is_active",
            "is_phone_verified",
            "date_joined",
            "updated_at",
        )


class RiderProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiderProfile
        fields = (
            "id",
            "rating_avg",
            "total_rides",
            "home_address",
            "home_lat",
            "home_lng",
            "work_address",
            "work_lat",
            "work_lng",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "rating_avg", "total_rides", "created_at", "updated_at")


class SwitchRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[User.Role.RIDER, User.Role.DRIVER])


class CountryCodeSerializer(serializers.Serializer):
    name = serializers.CharField()
    iso2 = serializers.CharField()
    dial_code = serializers.CharField()
    flag = serializers.CharField()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        response = {
            "access": data["access"],
            "refresh": data["refresh"],
            "role": user.active_role,
        }

        if user.active_role == User.Role.DRIVER:
            if user.is_driver:
                result = user.driver_profile.get_full_verification_status()
            else:
                result = {
                    "status": "NOT_STARTED",
                    "verified": False,
                    "detail": "Driver profile not created yet.",
                }

            response["verified"] = result["verified"]
            response["detail"] = result["detail"]

        return response