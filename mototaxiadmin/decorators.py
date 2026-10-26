from functools import wraps

from django.contrib import messages
from django.http import HttpResponse
from django.shortcuts import redirect
from django.views.decorators.cache import never_cache

from .views.helpers import is_admin_user


def _is_ajax(request):
    """True for the modal/detail fetches, so they get a clean 401/403 instead of a login page."""
    return (
        request.headers.get("x-requested-with") == "XMLHttpRequest"
        or "application/json" in request.headers.get("accept", "")
    )


def admin_required(view_func):
    """
    Allow only admins (superuser, staff, or active_role == "ADMIN").

    - Not logged in      -> redirect to the admin login page
    - Logged in, not admin -> redirect to the login page with an error message
    - AJAX request       -> 401 / 403 response (no redirect)
    - Pages are never cached, so the Back button after logout does not show admin data.
    """

    @wraps(view_func)
    @never_cache
    def _wrapped(request, *args, **kwargs):
        user = request.user

        if is_admin_user(user):
            return view_func(request, *args, **kwargs)

        if _is_ajax(request):
            status = 403 if user.is_authenticated else 401
            return HttpResponse("Admin access required.", status=status)

        if user.is_authenticated:
            messages.error(request, "Your account does not have admin access.")
        return redirect("mototaxiadmin:login")

    return _wrapped