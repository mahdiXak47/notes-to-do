import mimetypes
import uuid
from collections import defaultdict
from pathlib import Path

from django.http import Http404, HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

from vault.models import Folder, Note, Pin, UploadedFile
from vault.serializers import FolderSerializer, NoteSerializer
from vault.storage import uploaded_files_root


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


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def vault_pins(request):
    user = request.user
    if request.method == 'GET':
        pins = Pin.objects.filter(user=user).values('item_type', 'item_id')
        return Response(list(pins))

    # POST — create a pin
    item_type = (request.data.get('item_type') or '').strip()
    item_id = request.data.get('item_id')

    if item_type not in (Pin.FOLDER, Pin.NOTE):
        return Response(
            {'detail': 'item_type must be "folder" or "note".'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        item_id = int(item_id)
    except (TypeError, ValueError):
        return Response(
            {'detail': 'item_id must be an integer.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pin, created = Pin.objects.get_or_create(user=user, item_type=item_type, item_id=item_id)
    return Response(
        {'item_type': pin.item_type, 'item_id': pin.item_id},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def vault_pin_delete(request, item_type: str, item_id: int):
    deleted, _ = Pin.objects.filter(
        user=request.user,
        item_type=item_type,
        item_id=item_id,
    ).delete()
    if not deleted:
        raise Http404('Pin not found.')
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def vault_uploads(request):
    files = request.FILES.getlist('files')
    if not files:
        return Response({'detail': 'No files provided.'}, status=status.HTTP_400_BAD_REQUEST)
    upload_dir = uploaded_files_root(request.user.username)
    upload_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for f in files:
        ext = Path(f.name).suffix.lower()
        stored_name = f'{uuid.uuid4().hex}{ext}'
        dest = upload_dir / stored_name
        with dest.open('wb') as out:
            for chunk in f.chunks():
                out.write(chunk)
        mime = f.content_type or mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        record = UploadedFile.objects.create(
            user=request.user,
            stored_name=stored_name,
            original_name=f.name,
            mime_type=mime,
            size=f.size,
        )
        items.append({
            'id': record.stored_name,
            'original_name': record.original_name,
            'mime_type': record.mime_type,
            'size': record.size,
        })
    return Response({'items': items}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def vault_uploads_list(request):
    uploads = UploadedFile.objects.filter(user=request.user)
    items = [
        {
            'id': u.stored_name,
            'original_name': u.original_name,
            'mime_type': u.mime_type,
            'size': u.size,
        }
        for u in uploads
    ]
    return Response(items)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def vault_upload_detail(request, stored_name: str):
    try:
        record = UploadedFile.objects.get(user=request.user, stored_name=stored_name)
    except UploadedFile.DoesNotExist:
        raise Http404('Upload not found.')

    if request.method == 'GET':
        path = record.disk_path()
        if not path.is_file():
            raise Http404('File not found on disk.')
        with path.open('rb') as fh:
            content = fh.read()
        response = HttpResponse(content, content_type=record.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'inline; filename="{record.original_name}"'
        return response

    if request.method == 'PATCH':
        new_name = (request.data.get('name') or '').strip()
        if not new_name:
            return Response({'detail': 'Name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        record.original_name = new_name
        record.save(update_fields=['original_name'])
        return Response({'id': record.stored_name, 'original_name': record.original_name})

    # DELETE
    record.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
