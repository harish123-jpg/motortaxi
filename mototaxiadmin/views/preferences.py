
import json

from django.contrib import messages
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from ..decorators import admin_required


User = get_user_model()

ALLOWED_LANGS = {"en", "fr"}
ALLOWED_THEMES = {"light", "dark", "system"}


@admin_required
def settings_view(request):
    """Display the admin settings page."""

    admins = User.objects.filter(
        Q(active_role="ADMIN")
        | Q(is_staff=True)
        | Q(is_superuser=True)
    ).order_by("-date_joined")

    profile = request.user

    context = {
        "profile": profile,
        "admins": admins,
        "settings_form": {
            "language": request.session.get("mototaxi_lang", "en"),
            "theme": request.COOKIES.get("mototaxi_theme", "light"),
            "currency": "FCFA",
            "timezone": "Africa/Douala (WAT, UTC+1)",
        },
    }

    return render(request, "settings.html", context)


@require_POST
@admin_required
def settings_save(request):
    """Validate and save profile and preference settings."""

    user = request.user

    full_name = (request.POST.get("full_name") or "").strip()
    email = (request.POST.get("email") or "").strip()
    phone = (request.POST.get("phone_number") or "").strip()
    language = request.POST.get("language", "en")
    theme = request.POST.get("theme", "light")

    errors = []

    if not full_name:
        errors.append("Full name is required.")

    if not email:
        errors.append("Email address is required.")
    else:
        try:
            validate_email(email)
        except ValidationError:
            errors.append("Enter a valid email address.")
        else:
            if User.objects.exclude(pk=user.pk).filter(
                email__iexact=email
            ).exists():
                errors.append("This email address is already in use.")

    if phone and User.objects.exclude(pk=user.pk).filter(
        phone_number=phone
    ).exists():
        errors.append("This phone number is already in use.")

    if language not in ALLOWED_LANGS:
        errors.append("Please select a valid language.")

    if theme not in ALLOWED_THEMES:
        errors.append("Please select a valid theme.")

    if errors:
        for error in errors:
            messages.error(request, error)
        return redirect("mototaxiadmin:settings")

    user.full_name = full_name
    user.email = email
    user.phone_number = phone

    user.save(
        update_fields=["full_name", "email", "phone_number"]
    )

    request.session["mototaxi_lang"] = language

    response = redirect("mototaxiadmin:settings")
    response.set_cookie(
        "mototaxi_theme",
        theme,
        max_age=31536000,
        samesite="Lax",
        secure=request.is_secure(),
    )

    messages.success(request, "Settings saved successfully.")

    return response


@require_POST
@admin_required
def settings_change_password(request):
    """Change the authenticated admin's password."""

    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {
                "success": False,
                "message": "Invalid request data.",
            },
            status=400,
        )

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if not all(
        [current_password, new_password, confirm_password]
    ):
        return JsonResponse(
            {
                "success": False,
                "message": "All password fields are required.",
            },
            status=400,
        )

    user = request.user

    if not user.check_password(current_password):
        return JsonResponse(
            {
                "success": False,
                "message": "Current password is incorrect.",
            },
            status=400,
        )

    if new_password != confirm_password:
        return JsonResponse(
            {
                "success": False,
                "message": "New passwords do not match.",
            },
            status=400,
        )

    try:
        validate_password(new_password, user=user)
    except ValidationError as exc:
        return JsonResponse(
            {
                "success": False,
                "message": " ".join(exc.messages),
            },
            status=400,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])

    update_session_auth_hash(request, user)

    return JsonResponse(
        {
            "success": True,
            "message": "Password changed successfully.",
        }
    )
