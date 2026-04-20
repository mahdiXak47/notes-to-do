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
    body = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )

    class Meta:
        model = Note
        fields = ['id', 'folder', 'name', 'body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['body'] = instance.read_content()
        return data

    def validate_folder(self, value):
        request = self.context.get('request')
        if value is None:
            return value
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Invalid folder.')
        return value

    def create(self, validated_data):
        body = validated_data.pop('body', '')
        note = Note.objects.create(**validated_data)
        note.write_content(body)
        return note

    def update(self, instance, validated_data):
        body = validated_data.pop('body', None)
        note = super().update(instance, validated_data)
        if body is not None:
            note.write_content(body)
        return note
