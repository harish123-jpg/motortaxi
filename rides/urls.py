from django.urls import path
from . import views

urlpatterns = [
    path("fare-estimate/", views.fare_estimate, name="fare-estimate"),
    path("book/", views.book_ride, name="book-ride"),
]