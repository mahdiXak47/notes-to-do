from django.urls import include, path
from rest_framework.routers import DefaultRouter

from vault import views

router = DefaultRouter()
router.register('folders', views.FolderViewSet, basename='vault-folder')
router.register('notes', views.NoteViewSet, basename='vault-note')

urlpatterns = [
    path('tree/', views.vault_tree, name='vault-tree'),
    path('pins/', views.vault_pins, name='vault-pins'),
    path('pins/<str:item_type>/<int:item_id>/', views.vault_pin_delete, name='vault-pin-delete'),
    path('uploads-list/', views.vault_uploads_list, name='vault-uploads-list'),
    path('uploads/', views.vault_uploads, name='vault-uploads'),
    path('uploads/<str:stored_name>/', views.vault_upload_detail, name='vault-upload-detail'),
    path('settings/', views.user_settings, name='vault-user-settings'),
    path('', include(router.urls)),
]
