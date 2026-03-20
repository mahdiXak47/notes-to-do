# Backend (Django)

## Docker

Multi-stage image: **`Dockerfile`** (Hamravesh mirror **`hub.hamdocker.ir/library/python:3.12-slim`**, PyPI index **`https://repo.hmirror.ir/python/simple`**). Runtime runs **Gunicorn** on port **8000**.

**Entrypoint** (`docker-entrypoint.sh`):

1. **`python manage.py migrate --noinput`**
2. **`python ensure_superuser.py`** (only if `DJANGO_SUPERUSER_PASSWORD` is set; see below)
3. Start **Gunicorn** (default CMD)

Build and run (example):

```bash
cd backend
docker build -t notes-backend .
docker run --rm -p 8000:8000 \
  -e DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')" \
  -e DJANGO_DEBUG=false \
  -e DJANGO_SUPERUSER_PASSWORD='choose-a-strong-secret' \
  notes-backend
```

Persist SQLite and vault data by mounting a volume on **`/app`** (or at least `db.sqlite3` and `media/` / `SAVING_PATH`).

### Initial superuser (optional)

Do **not** commit real passwords. Set at **runtime** (Kubernetes Secret, Darkube env, etc.):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DJANGO_SUPERUSER_PASSWORD` | No | — | If set and no user with that username exists, creates a superuser. |
| `DJANGO_SUPERUSER_USERNAME` | No | `mahdixak` | Superuser login name. |
| `DJANGO_SUPERUSER_EMAIL` | No | `{username}@localhost` | Email stored on the user. |

If the user already exists, the script does nothing.

### Other environment variables

| Variable | Notes |
|----------|--------|
| `DJANGO_SECRET_KEY` | **Required in production.** Long random string; used for signing sessions and CSRF. |
| `DJANGO_DEBUG` | Default `true` in repo settings; set `false` in production. |
| `SAVING_PATH` | Vault markdown root on disk; see below. Empty → `MEDIA_ROOT` under `/app/media` in the container. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Comma-separated origins if the browser calls the API from another host (not needed when the frontend reverse-proxies `/api` on the same origin). |

**`ALLOWED_HOSTS`** in `config/settings.py` is fixed to **`0.0.0.0`**, **`localhost`**, and **`127.0.0.1`**. If you deploy behind a real hostname (e.g. `notes-to-do.darkube.app`), extend that list or add optional env-based hosts in settings so Django accepts the **`Host`** header from your ingress.

The app uses **SQLite** by default (`db.sqlite3` in the project directory). Use **one writable replica** or a **persistent volume**; multiple pods sharing one SQLite file is not supported. For several replicas, use PostgreSQL or MySQL and point **`DATABASES`** in settings accordingly.

---

## Vault storage: `SAVING_PATH`

User notes are stored as Markdown files on disk in addition to the database. The root directory for those files is controlled by the **`SAVING_PATH`** environment variable (read in `config/settings.py` as `VAULT_ROOT`).

### Behavior

| `SAVING_PATH` | Vault root on disk |
|---------------|-------------------|
| **Unset**, empty, or whitespace only | `MEDIA_ROOT`, i.e. **`<project>/backend/media/`** (resolved path). |
| **Set** to an absolute or relative path | That path is **resolved** (e.g. relative paths are resolved from the process current working directory) and used as the vault root. |

On-disk layout (same in both cases):

```text
<VAULT_ROOT>/<sanitized-username>/<folders...>/<note-name>.md
```

Folder names and file names are sanitized for safe paths; the logical name in the API/admin may differ slightly from the segment on disk when special characters are involved.

### Examples

**Default (development):** do not set `SAVING_PATH`. Files end up under `backend/media/<username>/`.

```bash
cd backend
# optional: activate your venv
python manage.py runserver
```

**Custom directory (e.g. dedicated data disk):** use an absolute path. The OS user running Django must be able to create directories and files there.

```bash
export SAVING_PATH=/var/lib/notes-vault
cd backend
python manage.py runserver
```

**One-off:**

```bash
SAVING_PATH=/data/notes ./.venv/bin/python manage.py runserver
```

**Docker / systemd / hosting:** set `SAVING_PATH` in the service environment or container env to your persistent volume mount.

### Notes

- **`MEDIA_ROOT`** remains `backend/media/` for Django’s default media handling; only the **vault** uses `VAULT_ROOT`. If `SAVING_PATH` is unset, vault and `MEDIA_ROOT` are the same directory.
- Ensure the process **owns or can write** `VAULT_ROOT` (and parents for `mkdir`).
- Changing `SAVING_PATH` does not move existing files; migrate data manually if you switch roots.

---

## Kubernetes / same-origin API

If the frontend is served by **nginx** and proxies **`/api/`** to this service, browsers call the API on the **same host**, so configure **`ALLOWED_HOSTS`** (and CORS if needed) for that public hostname. The backend Service DNS (e.g. `*.svc.cluster.local`) is only reachable **inside the cluster**; it is not a browser-facing API URL.
