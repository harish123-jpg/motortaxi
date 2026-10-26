"""Admin settings page (profile + language)."""
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Q
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from users.models import User

from ..decorators import admin_required

ALLOWED_LANGS = {"en", "fr"}  # adjust to the languages your login page offers


@admin_required
def settings_view(request):
    admins = User.objects.filter(
        Q(active_role="ADMIN") | Q(is_staff=True) | Q(is_superuser=True)
    ).order_by("-date_joined")[:5]
    ctx = {
        "admins": list(admins),
        "settings_form": {
            "language": request.session.get("mototaxi_lang", "en"),
            "theme": request.COOKIES.get("mototaxi_theme", "light"),
            "currency": "FCFA",
            "timezone": "Africa/Douala (WAT, UTC+1)",
        },
    }
    return render(request, "settings.html", ctx)


@require_POST
@admin_required
def settings_save(request):
    user = request.user
    full_name = (request.POST.get("full_name") or "").strip()
    email = (request.POST.get("email") or "").strip()
    phone = (request.POST.get("phone_number") or "").strip()
    lang = request.POST.get("language") or "en"

    others = User.objects.exclude(pk=user.pk)
    errors = []
    if email:
        try:
            validate_email(email)
        except ValidationError:
            errors.append("Invalid email address.")
        else:
            if others.filter(email__iexact=email).exists():
                errors.append("This email is already used by another account.")
    if phone and others.filter(phone_number=phone).exists():
        errors.append("This phone number is already used by another account.")
    if lang not in ALLOWED_LANGS:
        errors.append("Unsupported language.")

    if errors:
        for e in errors:
            messages.error(request, e)
        return redirect("mototaxiadmin:settings")

    fields = []
    for name, value in (("full_name", full_name), ("email", email), ("phone_number", phone)):
        if value:
            setattr(user, name, value)
            fields.append(name)
    if fields:
        user.save(update_fields=fields)
    request.session["mototaxi_lang"] = lang
    messages.success(request, "Settings saved successfully.")
    return redirect("mototaxiadmin:settings")
