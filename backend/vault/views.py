from collections import defaultdict

from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from vault.models import Folder, Note
from vault.serializers import FolderSerializer, NoteSerializer


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
