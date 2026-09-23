from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/driver/$", consumers.DriverConsumer.as_asgi()),
    re_path(r"ws/rider/$", consumers.RiderConsumer.as_asgi()),
]