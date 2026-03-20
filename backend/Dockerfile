# build stage
FROM hub.hamdocker.ir/library/python:3.12-slim AS builder

WORKDIR /build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=https://repo.hmirror.ir/python/simple

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn



# runtime stage
FROM hub.hamdocker.ir/library/python:3.12-slim AS runtime

# SAVING_PATH: vault markdown root; empty uses MEDIA_ROOT (/app/media). Override at run time with a volume path.
WORKDIR /app

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=https://repo.hmirror.ir/python/simple \
    SAVING_PATH=

COPY --from=builder /opt/venv /opt/venv

COPY . .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
    && adduser --disabled-password --gecos '' --no-create-home appuser \
    && chown -R appuser:appuser /app /docker-entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "config.wsgi:application"]
