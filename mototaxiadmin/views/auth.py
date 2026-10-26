"""Login / logout."""
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from users.models import User

from .helpers import is_admin_user


def login_view(request):
    if is_admin_user(request.user):
        return redirect("mototaxiadmin:dashboard")

    if request.method != "POST":
        return render(request, "login.html", {})

    identifier = (request.POST.get("identifier") or "").strip()
    password = request.POST.get("password") or ""
    remember = request.POST.get("remember_me") == "on"

    def fail(msg):
        messages.error(request, msg)
        return render(request, "login.html", {"identifier": identifier})

    if not identifier or not password:
        return fail("Please enter both identifier and password.")

    user = authenticate(request, username=identifier, password=password)
    if user is None and "@" in identifier:
        # .first() so duplicate emails can't raise MultipleObjectsReturned
        u = User.objects.filter(email__iexact=identifier).first()
        if u:
            user = authenticate(request, username=u.phone_number, password=password)

    if user is None:
        return fail("Invalid credentials. Please try again.")
    if not is_admin_user(user):
        return fail("Your account does not have admin access.")

    login(request, user)
    if not remember:
        request.session.set_expiry(0)
    if request.POST.get("lang"):
        request.session["mototaxi_lang"] = request.POST["lang"]
    messages.success(request, f"Welcome back, {user.full_name or user.username}!")
    return redirect("mototaxiadmin:dashboard")


@require_POST
def logout_view(request):
    logout(request)
    messages.info(request, "You have been signed out.")
    return redirect("mototaxiadmin:login")
