import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-t+71=ge@5nc+gs4gt(v_o5!np2n3syssk(l!d2h(!0oe_*g7(l',
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'true').lower() in ('1', 'true', 'yes')

ALLOWED_HOSTS = [
    '0.0.0.0',
    'localhost',
    '127.0.0.1',
    'notestodo-core.darkube.app',
    'notes-to-do.darkube.app',
    'notes-to-do.darkube.ir',
    'notestodo.mahdixak.ir',
]
_extra_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS', '').strip()
if _extra_hosts:
    ALLOWED_HOSTS.extend(h.strip() for h in _extra_hosts.split(',') if h.strip())

# Scheme + host; required for admin and any HTTPS POST when DEBUG is False (and recommended always).
CSRF_TRUSTED_ORIGINS = [
    'https://notestodo-core.darkube.app',
    'https://notes-to-do.darkube.app',
    'https://notestodo.mahdixak.ir',
]
_extra_csrf = os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').strip()
if _extra_csrf:
    CSRF_TRUSTED_ORIGINS.extend(
        o.strip() for o in _extra_csrf.split(',') if o.strip()
    )

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'accounts',
    'vault',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases


def _db_host_and_port(host_with_port: str) -> tuple[str, str]:
    """Split host:port for Postgres; default port 5432 when omitted."""
    raw = (host_with_port or '').strip()
    if not raw:
        return 'localhost', '5432'
    if ':' in raw:
        host, _, maybe_port = raw.rpartition(':')
        if maybe_port.isdigit():
            return host, maybe_port
    return raw, '5432'


_DB_TO_USE = os.environ.get('DB_TO_USE', 'dev').strip().lower()
_USE_POSTGRES = _DB_TO_USE in ('production', 'postgres', 'prod')

if _USE_POSTGRES:
    _pg_env = {
        'DB_NAME': os.environ.get('DB_NAME'),
        'DB_USER': os.environ.get('DB_USER'),
        'DB_PASSWORD': os.environ.get('DB_PASSWORD'),
        'DB_HOST': os.environ.get('DB_HOST'),
    }
    _missing_pg = [k for k, v in _pg_env.items() if not (v and str(v).strip())]
    if _missing_pg:
        raise ImproperlyConfigured(
            'When DB_TO_USE selects PostgreSQL (production, prod, or postgres), '
            'set these environment variables to non-empty values: '
            + ', '.join(_missing_pg) + '.'
        )
    _pg_host, _pg_port = _db_host_and_port(_pg_env['DB_HOST'])
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': _pg_env['DB_NAME'].strip(),
            'USER': _pg_env['DB_USER'].strip(),
            'PASSWORD': _pg_env['DB_PASSWORD'],
            'HOST': _pg_host,
            'PORT': _pg_port,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Serve the built React SPA from / via whitenoise (falls through to Django catch-all if not found)
WHITENOISE_ROOT = BASE_DIR / 'frontend_build'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_ROOT = BASE_DIR / 'media'
_saving_path = os.environ.get('SAVING_PATH', '').strip()
# User vault files: <VAULT_ROOT>/<username>/... When SAVING_PATH is unset, use MEDIA_ROOT.
VAULT_ROOT = Path(_saving_path).resolve() if _saving_path else MEDIA_ROOT

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

