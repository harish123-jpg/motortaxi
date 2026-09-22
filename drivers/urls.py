from django.urls import path

from .views import DriverDocumentListCreateView, DriverProfileView, GoOfflineView, GoOnlineView

urlpatterns = [
    path("profile/", DriverProfileView.as_view(), name="driver-profile"),
    path("documents/", DriverDocumentListCreateView.as_view(), name="driver-documents"),
    path("go-online/", GoOnlineView.as_view(), name="driver-go-online"),
    path("go-offline/", GoOfflineView.as_view(), name="driver-go-offline"),
]