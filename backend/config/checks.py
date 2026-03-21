"""Project-wide Django system checks."""

from django.conf import settings
from django.core.checks import Error, register
from django.db import connections


@register()
def check_postgresql_reachable(app_configs, **kwargs):
    """Verifies the default database accepts connections when using PostgreSQL."""
    engine = settings.DATABASES['default'].get('ENGINE', '')
    if 'postgresql' not in engine:
        return []
    try:
        connections['default'].ensure_connection()
    except Exception as exc:
        return [
            Error(
                'Could not connect to PostgreSQL using DB_HOST (host and optional '
                'port), DB_NAME, DB_USER, and DB_PASSWORD. Confirm the server is '
                'reachable from this process, the database exists, and credentials '
                f'are correct. Underlying error: {exc}',
                id='config.E001',
            ),
        ]
    return []
