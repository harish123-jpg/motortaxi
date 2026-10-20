import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from drivers.ez_qr import parse_ride_ref, mark_ride_paid


class InternalKeyPermission(BasePermission):
    def has_permission(self, request, view):
        expected = getattr(settings, "EZTRANSFER_INTERNAL_KEY", "")
        sent = request.headers.get("X-Internal-Key", "")
        return bool(expected) and hmac.compare_digest(sent.encode(), expected.encode())


class RidePaidWebhookView(APIView):
    authentication_classes = []
    permission_classes = [InternalKeyPermission]

    def post(self, request):
        ride_id = parse_ride_ref(request.data.get("ref"))
        if ride_id is None:
            return Response({"detail": "Invalid ref."}, status=400)
        result = mark_ride_paid(
            ride_id,
            request.data.get("amount"),
            request.data.get("transaction_id"),
            request.data.get("invoice_no"),
        )
        if result in ("paid", "already"):
            return Response({"ok": True})
        if result == "not_found":
            return Response({"detail": result}, status=404)
        return Response({"detail": result}, status=409)