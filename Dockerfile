# Stage 1: Build React frontend
FROM hub.hamdocker.ir/node:22-alpine AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm config set registry https://repo.hmirror.ir/npm && npm ci

COPY frontend/ .
RUN npm run build


# Stage 2: Install Python dependencies
FROM hub.hamdocker.ir/library/python:3.12-slim AS python-builder
WORKDIR /build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=https://repo.hmirror.ir/python/simple

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn


# Stage 3: Runtime
FROM hub.hamdocker.ir/library/python:3.12-slim AS runtime

WORKDIR /app

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=https://repo.hmirror.ir/python/simple \
    SAVING_PATH=

COPY --from=python-builder /opt/venv /opt/venv

# Copy Django project
COPY backend/ .

# Copy built React app — Django serves this via whitenoise at /
COPY --from=frontend-build /app/dist ./frontend_build

COPY backend/docker-entrypoint.sh /docker-entrypoint.sh

RUN python manage.py collectstatic --noinput \
    && chmod +x /docker-entrypoint.sh \
    && adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app /docker-entrypoint.sh /home/appuser

USER appuser

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "config.wsgi:application"]
