from django.urls import path
from . import views
from .location_history import recent_drop_locations

urlpatterns = [
    path("fare-estimate/", views.fare_estimate, name="fare-estimate"),
    path("book/", views.book_ride, name="book-ride"),
    path("recent-drops/", recent_drop_locations, name="recent-drops"),
    path("my-rides/", views.my_rides, name="my-rides"),
    path("driver-rides/", views.driver_rides, name="driver-rides"),
    path("active/", views.active_ride, name="active-ride"),
    path("<int:ride_id>/", views.ride_detail, name="ride-detail"),
    path("<int:ride_id>/cancel/", views.cancel_ride, name="cancel-ride"),
    path("<int:ride_id>/rate/", views.rate_ride, name="rate-ride"),
]