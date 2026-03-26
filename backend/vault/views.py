from collections import defaultdict
import logging
import mimetypes
import os
import uuid
from pathlib import Path

from django.http import FileResponse, Http404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

from vault.models import Folder, Note
from vault.serializers import FolderSerializer, NoteSerializer
from vault.storage import UploadedFilesStorage, sanitize_segment, uploaded_files_root

logger = logging.getLogger('vault')

_ALLOWED_UPLOAD_EXTS = {'.txt', '.md', '.png', '.jpg', '.jpeg', '.svg'}


def _is_allowed_upload_name(name: str) -> bool:
    ext = Path(name).suffix.lower()
    return ext in _ALLOWED_UPLOAD_EXTS


def _guess_mime_type(filename: str, fallback: str | None) -> str:
    mime = mimetypes.guess_type(filename)[0]
    return mime or fallback or 'application/octet-stream'


def _uploaded_original_name(stored_name: str) -> str:
    raw = Path(stored_name).name
    if '__' not in raw:
        return raw
    _uuid, rest = raw.split('__', 1)
    return rest


class FolderViewSet(viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Folder.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Note.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


def _sort_root_nodes(nodes):
    def key(n):
        return (0 if n['type'] == 'folder' else 1, n['name'].lower())

    nodes.sort(key=key)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def vault_tree(request):
    user = request.user
    folders = list(Folder.objects.filter(user=user))
    notes = list(Note.objects.filter(user=user))
    children_folders = defaultdict(list)
    for f in folders:
        children_folders[f.parent_id].append(f)
    children_notes = defaultdict(list)
    for n in notes:
        children_notes[n.folder_id].append(n)
    for bucket in children_folders.values():
        bucket.sort(key=lambda x: x.name.lower())
    for bucket in children_notes.values():
        bucket.sort(key=lambda x: x.name.lower())

    def build_folder(folder):
        subs = children_folders.get(folder.id, [])
        ns = children_notes.get(folder.id, [])
        ch = [build_folder(sf) for sf in subs] + [build_note(note) for note in ns]
        _sort_root_nodes(ch)
        return {
            'id': folder.id,
            'kind': 'folder',
            'type': 'folder',
            'name': folder.name,
            'children': ch,
        }

    def build_note(note):
        return {
            'id': note.id,
            'kind': 'note',
            'type': 'file',
            'name': note.name,
            'content': note.read_content(),
            'meta': None,
        }

    root = [build_folder(f) for f in children_folders.get(None, [])] + [
        build_note(n) for n in children_notes.get(None, [])
    ]
    _sort_root_nodes(root)
    return Response(root)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def vault_uploads_list(request):
    username = request.user.username
    root = uploaded_files_root(username)
    logger.debug('[upload] vault_uploads_list — user: %s | root: %s | exists: %s', username, root, root.exists())
    if not root.exists():
        return Response([])
    items = []
    for p in root.iterdir():
        if not p.is_file():
            continue
        name = p.name
        if not _is_allowed_upload_name(name):
            continue
        st = p.stat()
        mime_type = _guess_mime_type(name, None)
        items.append({
            'id': name,
            'original_name': _uploaded_original_name(name),
            'mime_type': mime_type,
            'size': st.st_size,
            'created_at_ms': int(st.st_mtime * 1000),
        })
    items.sort(key=lambda x: x['created_at_ms'], reverse=True)
    logger.debug('[upload] vault_uploads_list — returning %d items', len(items))
    return Response(items)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def vault_uploads(request):
    max_bytes = int(os.environ.get('UPLOAD_MAX_BYTES', str(20 * 1024 * 1024)))
    username = request.user.username
    logger.debug('[upload] vault_uploads called — user: %s', username)

    storage = UploadedFilesStorage(username)
    root = uploaded_files_root(username)
    logger.debug('[upload] upload root path: %s | exists: %s', root, root.exists())
    root.mkdir(parents=True, exist_ok=True)

    uploaded_files = request.FILES.getlist('files') or []
    logger.debug('[upload] FILES keys: %s | "files" field count: %d', list(request.FILES.keys()), len(uploaded_files))
    if not uploaded_files:
        single = request.FILES.get('file')
        if single is not None:
            uploaded_files = [single]
            logger.debug('[upload] fell back to single "file" field: %s', single.name)

    if not uploaded_files:
        logger.warning('[upload] no files found in request for user: %s', username)
        return Response(
            {'items': [], 'errors': [{'reason': 'No files provided.'}]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    items = []
    errors = []
    for f in uploaded_files:
        filename = getattr(f, 'name', '') or ''
        logger.debug('[upload] processing file: %s | size: %s | content_type: %s', filename, getattr(f, 'size', '?'), getattr(f, 'content_type', '?'))
        if not filename or not _is_allowed_upload_name(filename):
            logger.warning('[upload] rejected — unsupported file type: %s', filename)
            errors.append({'name': filename, 'reason': f'Unsupported file type. Allowed: {sorted(_ALLOWED_UPLOAD_EXTS)}.'})
            continue
        if getattr(f, 'size', 0) > max_bytes:
            logger.warning('[upload] rejected — file too large: %s (%d bytes)', filename, f.size)
            errors.append({'name': filename, 'reason': f'File too large. Max: {max_bytes} bytes.'})
            continue

        p = Path(filename)
        ext = p.suffix.lower()
        stem = sanitize_segment(p.stem)
        desired_name = f'{uuid.uuid4().hex}__{stem}{ext}'
        logger.debug('[upload] saving — desired name: %s', desired_name)
        stored_name = storage.save(desired_name, f)
        final_path = root / stored_name
        logger.debug('[upload] saved as: %s | path exists: %s', stored_name, final_path.exists())
        mime_type = _guess_mime_type(filename, getattr(f, 'content_type', None))
        items.append({
            'id': stored_name,
            'original_name': filename,
            'mime_type': mime_type,
            'size': getattr(f, 'size', None),
        })

    logger.debug('[upload] done — saved: %d | errors: %d', len(items), len(errors))
    return Response({'items': items, 'errors': errors})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def vault_upload_raw(request, stored_name: str):
    logger.debug('[upload] vault_upload_raw — stored_name: %s', stored_name)
    token = request.query_params.get('access_token')
    if token and not request.headers.get('Authorization'):
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'

    auth = JWTAuthentication()
    try:
        user, _auth_token = auth.authenticate(request)
        logger.debug('[upload] vault_upload_raw — authenticated as: %s', user.username)
    except Exception as e:  # noqa: BLE001
        logger.warning('[upload] vault_upload_raw — auth failed: %s', e)
        raise AuthenticationFailed(str(e) or 'Authentication failed.') from e

    storage = UploadedFilesStorage(user.username)
    safe = storage.get_valid_name(stored_name)
    logger.debug('[upload] vault_upload_raw — sanitized: %s | exists: %s', safe, storage.exists(safe))
    if not storage.exists(safe):
        raise Http404('File not found.')

    filename = _uploaded_original_name(safe)
    mime_type = _guess_mime_type(filename, None)
    f = storage.open(safe, 'rb')
    resp = FileResponse(f, content_type=mime_type)
    resp['Content-Disposition'] = f'inline; filename="{filename}"'
    return resp
