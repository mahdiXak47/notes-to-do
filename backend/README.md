# Backend (Django)

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
