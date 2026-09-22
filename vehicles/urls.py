from django.urls import path

from .views import (
    BulkVehicleDocumentUploadView,
    VehicleDetailView,
    VehicleDocumentListCreateView,
    VehicleListCreateView,
)

urlpatterns = [
    path("", VehicleListCreateView.as_view(), name="vehicle-list-create"),
    path("<int:pk>/", VehicleDetailView.as_view(), name="vehicle-detail"),
    path("<int:vehicle_id>/documents/", VehicleDocumentListCreateView.as_view(), name="vehicle-documents"),
    path(
        "<int:vehicle_id>/documents/bulk-upload/",
        BulkVehicleDocumentUploadView.as_view(),
        name="vehicle-documents-bulk-upload",
    ),
]