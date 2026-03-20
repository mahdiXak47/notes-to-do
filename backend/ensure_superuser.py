"""Create the initial superuser when env vars are set; no-op if user exists or password unset."""
import os
import sys

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model


def main() -> None:
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '').strip()
    if not password:
        return
    username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'mahdixak').strip()
    email = os.environ.get('DJANGO_SUPERUSER_EMAIL', f'{username}@localhost').strip()
    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'Created superuser {username!r}.', file=sys.stderr)


if __name__ == '__main__':
    main()
