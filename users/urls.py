from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import MeView, RegisterView, RiderProfileView, SwitchRoleView, CountryCodeListView, \
    CustomTokenObtainPairView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("rider-profile/", RiderProfileView.as_view(), name="rider-profile"),
    path("switch-role/", SwitchRoleView.as_view(), name="switch-role"),
    path("country-codes/", CountryCodeListView.as_view(), name="country-codes"),

]