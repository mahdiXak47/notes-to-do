import logging
import re
from pathlib import Path

from django.core.files.storage import FileSystemStorage

logger = logging.getLogger('vault')

_UPLOADED_FILES_SUBDIR = 'uploaded-files'
_MD_FILES_SUBDIR = 'files'


def sanitize_segment(name: str) -> str:
    name = (name or '').strip() or 'untitled'
    name = name.replace('\0', '')
    name = name.replace('/', '_').replace('\\', '_')
    if name in ('.', '..'):
        return 'untitled'
    name = re.sub(r'[\x00-\x1f]', '_', name)
    return name[:255] if len(name) > 255 else name


def vault_root() -> Path:
    from django.conf import settings

    return Path(settings.VAULT_ROOT)


def uploaded_files_root(username: str) -> Path:
    """Return per-user directory where uploaded binaries should be saved."""
    return vault_root() / sanitize_segment(username) / _UPLOADED_FILES_SUBDIR


def md_files_root(username: str) -> Path:
    """Return per-user directory where markdown note files should be saved."""
    return vault_root() / sanitize_segment(username) / _MD_FILES_SUBDIR


class UploadedFilesStorage(FileSystemStorage):
    """FileSystemStorage for storing per-user uploaded binaries."""

    def __init__(self, username: str, *args, **kwargs):
        location = uploaded_files_root(username)
        logger.debug('[storage] UploadedFilesStorage.__init__ — username: %s | location: %s', username, location)
        kwargs.setdefault('location', str(location))
        kwargs.setdefault('base_url', '')
        super().__init__(*args, **kwargs)

    def get_valid_name(self, name):
        safe = sanitize_segment(Path(str(name)).name)
        logger.debug('[storage] get_valid_name — input: %s | output: %s', name, safe)
        return safe

    def save(self, name, content, max_length=None):
        saved = super().save(name, content, max_length=max_length)
        logger.debug('[storage] save() — requested: %s | saved as: %s | full path: %s', name, saved, Path(self.location) / saved)
        return saved
