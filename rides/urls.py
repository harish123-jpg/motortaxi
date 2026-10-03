from django.urls import path
from . import views
from .location_history import recent_drop_locations

urlpatterns = [
    path("fare-estimate/", views.fare_estimate, name="fare-estimate"),
    path("book/", views.book_ride, name="book-ride"),
    path("recent-drops/", recent_drop_locations, name="recent-drops"),
]