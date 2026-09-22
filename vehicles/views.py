from django.db import IntegrityError, transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Vehicle, VehicleDocument
from .serializers import BulkVehicleDocumentSerializer, VehicleDocumentSerializer, VehicleSerializer


class VehicleListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(driver__user=self.request.user)

    def perform_create(self, serializer):
        if not hasattr(self.request.user, "driver_profile"):
            raise generics.ValidationError(
                {"detail": "Driver profile not found. Please complete onboarding first."}
            )

        profile = self.request.user.driver_profile

        try:
            with transaction.atomic():
                serializer.save(driver=profile)
        except IntegrityError:
            raise generics.ValidationError(
                {"detail": "A vehicle with this plate number already exists."}
            )


class VehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(driver__user=self.request.user)

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise generics.ValidationError(
                {"detail": "A vehicle with this plate number already exists."}
            )


class VehicleDocumentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VehicleDocumentSerializer

    def get_queryset(self):
        return VehicleDocument.objects.filter(
            vehicle_id=self.kwargs["vehicle_id"],
            vehicle__driver__user=self.request.user,
        )

    def perform_create(self, serializer):
        vehicle = Vehicle.objects.filter(
            id=self.kwargs["vehicle_id"],
            driver__user=self.request.user,
        ).first()

        if not vehicle:
            raise generics.ValidationError(
                {"detail": "Vehicle not found or does not belong to this driver."}
            )

        try:
            with transaction.atomic():
                serializer.save(vehicle=vehicle)
        except IntegrityError:
            raise generics.ValidationError(
                {"detail": "A document of this type already exists for this vehicle. Use update instead."}
            )


class BulkVehicleDocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    DOC_TYPE_MAP = {
        "rc": VehicleDocument.DocumentType.RC,
        "insurance": VehicleDocument.DocumentType.INSURANCE,
        "puc": VehicleDocument.DocumentType.PUC,
        "permit": VehicleDocument.DocumentType.PERMIT,
    }

    def post(self, request, vehicle_id):
        vehicle = Vehicle.objects.filter(
            id=vehicle_id, driver__user=request.user
        ).first()

        if not vehicle:
            return Response(
                {"detail": "Vehicle not found or does not belong to this driver."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = BulkVehicleDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        results = []
        try:
            with transaction.atomic():
                for prefix, document_type in self.DOC_TYPE_MAP.items():
                    file = data.get(f"{prefix}_file")
                    if not file:
                        continue

                    document, _ = VehicleDocument.objects.update_or_create(
                        vehicle=vehicle,
                        document_type=document_type,
                        defaults={
                            "document_file": file,
                            "document_number": data.get(f"{prefix}_number", ""),
                            "issue_date": data.get(f"{prefix}_issue_date"),
                            "expiry_date": data.get(f"{prefix}_expiry_date"),
                            "verification_status": VehicleDocument.VerificationStatus.PENDING,
                            "rejection_reason": "",
                            "verified_at": None,
                        },
                    )
                    results.append(document)
        except IntegrityError:
            return Response(
                {"detail": "Could not save documents due to a conflict. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not results:
            return Response(
                {"detail": "No valid documents were provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            VehicleDocumentSerializer(results, many=True).data,
            status=status.HTTP_201_CREATED,
        )