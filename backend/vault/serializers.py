from rest_framework import serializers

from vault.models import Folder, Note


class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'parent', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_parent(self, value):
        request = self.context.get('request')
        if value is None:
            return value
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Invalid parent folder.')
        return value


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'folder', 'name', 'body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_folder(self, value):
        request = self.context.get('request')
        if value is None:
            return value
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Invalid folder.')
        return value
