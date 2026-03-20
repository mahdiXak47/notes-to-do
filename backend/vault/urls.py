from django.urls import include, path
from rest_framework.routers import DefaultRouter

from vault import views

router = DefaultRouter()
router.register('folders', views.FolderViewSet, basename='vault-folder')
router.register('notes', views.NoteViewSet, basename='vault-note')

urlpatterns = [
    path('tree/', views.vault_tree, name='vault-tree'),
    path('', include(router.urls)),
]
