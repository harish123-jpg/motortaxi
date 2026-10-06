from django.urls import path

from .views import *

urlpatterns = [
    path("profile/", DriverProfileView.as_view(), name="driver-profile"),
    path("documents/", DriverDocumentListCreateView.as_view(), name="driver-documents"),
    path("go-online/", GoOnlineView.as_view(), name="driver-go-online"),
    path("go-offline/", GoOfflineView.as_view(), name="driver-go-offline"),
    path("location/", UpdateLocationView.as_view(), name="update-location"),
    path("wallet/",wallet_balance, name="wallet-balance"),
    path("wallet/transactions/", wallet_transactions, name="wallet-transactions"),
    path("wallet/summary/", wallet_summary, name="wallet-summary"),
    path("stats/home/", driver_home_stats, name="driver-home-stats"),

]