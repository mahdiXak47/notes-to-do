#!/bin/sh
set -e
cd /app
python manage.py check
python manage.py migrate --noinput
python ensure_superuser.py
exec "$@"
