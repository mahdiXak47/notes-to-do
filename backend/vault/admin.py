from django.contrib import admin

from vault.models import Folder, Note


@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'parent', 'updated_at')
    list_filter = ('user',)
    search_fields = ('name',)
    raw_id_fields = ('parent',)


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'folder', 'updated_at')
    list_filter = ('user',)
    search_fields = ('name',)
    raw_id_fields = ('folder',)
