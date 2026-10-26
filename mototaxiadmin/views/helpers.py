import csv
import re

from django.core.paginator import Paginator
from django.http import HttpResponse
from django.utils.dateparse import parse_date


def is_admin_user(user):
    return bool(
        user.is_authenticated
        and (user.is_superuser or getattr(user, "is_staff", False) or getattr(user, "active_role", None) == "ADMIN")
    )


def paginate(request, queryset, per_page=10):
    """get_page() already falls back to page 1 / last page on bad input."""
    return Paginator(queryset, per_page).get_page(request.GET.get("page"))


def safe_date(raw):
    try:
        return parse_date(raw or "")
    except ValueError:
        return None


def apply_date_range(qs, request, field="created_at"):
    """Filter by ?date_from / ?date_to; invalid dates are ignored instead of causing a 500."""
    d_from = safe_date(request.GET.get("date_from"))
    d_to = safe_date(request.GET.get("date_to"))
    # NOTE: build the dict in a variable first. Writing **{f"...": v} inline crashes the Cython compiler.
    if d_from:
        lookup = {f"{field}__date__gte": d_from}
        qs = qs.filter(**lookup)
    if d_to:
        lookup = {f"{field}__date__lte": d_to}
        qs = qs.filter(**lookup)
    return qs


# ----- CSV -----
_NUMBER_LIKE = re.compile(r"[+\-]?[\d\s().\-]+")


def _csv_safe(value):
    """Stop spreadsheet formula injection (=, @, +, -) but keep phone numbers intact."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        if not _NUMBER_LIKE.fullmatch(value):
            return "'" + value
    return value


def csv_response(filename, rows):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("\ufeff")
    if rows:
        writer = csv.DictWriter(response, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow({k: _csv_safe(v) for k, v in row.items()})
    return response