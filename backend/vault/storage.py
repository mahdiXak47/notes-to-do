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
    return vault_root() / sanitize_segment(username) / 'uploads'
