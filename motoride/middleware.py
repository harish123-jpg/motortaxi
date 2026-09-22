from django.utils import translation
from django.conf import settings


class QueryParamLanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.valid_langs = [lang[0] for lang in getattr(settings, 'LANGUAGES', [('en', 'English')])]
        self.default_lang = getattr(settings, 'MODELTRANSLATION_DEFAULT_LANGUAGE', 'en')

    def __call__(self, request):
        lang = request.GET.get('lang') or request.headers.get('X-Language')

        if lang and lang in self.valid_langs:
            translation.activate(lang)
            request.LANGUAGE_CODE = lang
        else:
            translation.activate(self.default_lang)
            request.LANGUAGE_CODE = self.default_lang

        response = self.get_response(request)
        translation.deactivate()
        return response