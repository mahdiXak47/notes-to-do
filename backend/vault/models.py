import shutil
from pathlib import Path

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models

from vault.storage import sanitize_segment, vault_root


class Folder(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='vault_folders',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'parent', 'name'],
                name='vault_folder_unique_per_parent',
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.parent_id and self.parent.user_id != self.user_id:
            raise ValidationError(
                {'parent': 'Parent folder must belong to the same user.'},
            )
        p = self.parent
        while p is not None:
            if self.pk is not None and p.pk == self.pk:
                raise ValidationError({'parent': 'A folder cannot be its own ancestor.'})
            p = p.parent

    def path_segments(self):
        if self.parent_id:
            return self.parent.path_segments() + [sanitize_segment(self.name)]
        return [sanitize_segment(self.name)]

    def disk_path(self) -> Path:
        base = vault_root() / sanitize_segment(self.user.username)
        return (base / Path(*self.path_segments())).resolve()

    def save(self, *args, **kwargs):
        old_path = None
        if self.pk:
            try:
                prev = Folder.objects.get(pk=self.pk)
                old_path = prev.disk_path()
            except Folder.DoesNotExist:
                pass
        super().save(*args, **kwargs)
        new_path = self.disk_path()
        if old_path is not None and old_path != new_path and old_path.exists():
            new_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_path), str(new_path))
        else:
            new_path.mkdir(parents=True, exist_ok=True)

    def delete(self, *args, **kwargs):
        path = self.disk_path()
        super().delete(*args, **kwargs)
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)


class Note(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='vault_notes',
    )
    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notes',
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'folder', 'name'],
                name='vault_note_unique_per_folder',
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.folder_id and self.folder.user_id != self.user_id:
            raise ValidationError(
                {'folder': 'Folder must belong to the same user.'},
            )

    def get_fs_path(self) -> Path:
        base = vault_root() / sanitize_segment(self.user.username)
        if self.folder_id:
            rel = Path(*self.folder.path_segments())
            return (base / rel / f'{sanitize_segment(self.name)}.md').resolve()
        return (base / f'{sanitize_segment(self.name)}.md').resolve()

    def read_content(self) -> str:
        path = self.get_fs_path()
        if not path.is_file():
            return ''
        return path.read_text(encoding='utf-8', errors='replace')

    def write_content(self, text: str) -> None:
        path = self.get_fs_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text or '', encoding='utf-8')

    def save(self, *args, **kwargs):
        old_path = None
        if self.pk:
            try:
                old = Note.objects.get(pk=self.pk)
                old_path = old.get_fs_path()
            except Note.DoesNotExist:
                pass
        super().save(*args, **kwargs)
        new_path = self.get_fs_path()
        new_path.parent.mkdir(parents=True, exist_ok=True)
        if old_path is not None and old_path != new_path:
            if old_path.is_file():
                try:
                    shutil.move(str(old_path), str(new_path))
                except OSError:
                    if not new_path.is_file():
                        new_path.write_text('', encoding='utf-8')
            elif not new_path.is_file():
                new_path.write_text('', encoding='utf-8')
        elif not new_path.is_file():
            new_path.write_text('', encoding='utf-8')

    def delete(self, *args, **kwargs):
        path = self.get_fs_path()
        super().delete(*args, **kwargs)
        if path.is_file():
            try:
                path.unlink()
            except OSError:
                pass
