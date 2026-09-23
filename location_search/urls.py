from django.urls import path
from . import views

urlpatterns = [
    path("search/", views.location_search, name="location-search"),
    path("reverse/", views.reverse_geocode, name="location-reverse"),
]