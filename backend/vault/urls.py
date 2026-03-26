from django.urls import include, path
from rest_framework.routers import DefaultRouter

from vault import views

router = DefaultRouter()
router.register('folders', views.FolderViewSet, basename='vault-folder')
router.register('notes', views.NoteViewSet, basename='vault-note')

urlpatterns = [
    path('tree/', views.vault_tree, name='vault-tree'),
    path('uploads-list/', views.vault_uploads_list, name='vault-uploads-list'),
    path('uploads/', views.vault_uploads, name='vault-uploads'),
    path('uploads/<str:stored_name>/', views.vault_upload_raw, name='vault-upload-raw'),
    path('', include(router.urls)),
]
