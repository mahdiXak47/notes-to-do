# Backend (Django)

## Docker

The image runs **`python manage.py collectstatic`** during the build. **WhiteNoise** serves **`/static/`** (Django admin CSS/JS included). Without that step, admin pages return **404** for static URLs and the browser reports wrong **MIME types** because it receives HTML error bodies instead of CSS/JS.

Runtime runs **Gunicorn** on port **8000**.

**Entrypoint** (`docker-entrypoint.sh`):

1. **`python manage.py check`** (includes a PostgreSQL connectivity check when `DB_TO_USE` selects Postgres; exits non-zero on failure).
2. **`python manage.py migrate --noinput`**
3. **`python ensure_superuser.py`** (only if `DJANGO_SUPERUSER_PASSWORD` is set; see below)
4. Start **Gunicorn** (default CMD)

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
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Optional extra entries (comma-separated, each with scheme, e.g. `https://api.example.com`). Defaults in `settings.py` already include Darkube and local dev URLs for admin CSRF. |

**`ALLOWED_HOSTS`** in `config/settings.py` is fixed to **`0.0.0.0`**, **`localhost`**, and **`127.0.0.1`**. If you deploy behind a real hostname (e.g. `notes-to-do.darkube.app`), extend that list or add optional env-based hosts in settings so Django accepts the **`Host`** header from your ingress.

### Database: `DB_TO_USE` and PostgreSQL

| Variable | Values | Purpose |
|----------|--------|---------|
| `DB_TO_USE` | `dev` (default) | SQLite at `db.sqlite3`. |
| `DB_TO_USE` | `production`, `prod`, or `postgres` | PostgreSQL; requires the variables below. |

When using PostgreSQL (e.g. Kubernetes service `notes-todo-db.mahdixak.svc:5432`):

| Variable | Example | Purpose |
|----------|---------|---------|
| `DB_USER` | — | Database user. |
| `DB_PASSWORD` | — | Database password. |
| `DB_HOST` | `notes-todo-db.mahdixak.svc:5432` | Required and non-empty. Host and port in one value (`host:port`). Port defaults to **5432** if you omit `:port`. |
| `DB_NAME` | — | Database name. |

If any of **`DB_NAME`**, **`DB_USER`**, **`DB_PASSWORD`**, or **`DB_HOST`** is missing or blank when Postgres is selected, Django raises **`ImproperlyConfigured`** at startup. If the server is unreachable or credentials are wrong, **`python manage.py check`** reports **`config.E001`** with the underlying driver error (the container entrypoint runs **`check`** before **`migrate`**).

Run **`python manage.py migrate`** against the new database so Django creates all tables (see below). Use **one writable SQLite file** or Postgres; multiple pods must use Postgres, not a shared SQLite file.

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
