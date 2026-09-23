from django.urls import path
from . import views

urlpatterns = [
    path("fare-estimate/", views.fare_estimate, name="fare-estimate"),
    path("book/", views.book_ride, name="book-ride"),
    path("", views.my_rides, name="my-rides"),
    path("active/", views.active_ride, name="active-ride"),
    path("<int:ride_id>/", views.ride_detail, name="ride-detail"),
    path("<int:ride_id>/cancel/", views.cancel_ride, name="cancel-ride"),
]
