import re
from pathlib import Path


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
