from django.urls import path

from .views import (
    DashboardView,
    LoginView,
    MeView,
    RolePermissionView,
    SetActiveView,
    UserDetailView,
    UserListView,
)

urlpatterns = [
    path("login/", LoginView.as_view()),
    path("me/", MeView.as_view()),
    path("dashboard/", DashboardView.as_view()),
    path("users/", UserListView.as_view()),
    path("users/<int:pk>/", UserDetailView.as_view()),
    path("users/<int:pk>/ban/", SetActiveView.as_view(active=False)),
    path("users/<int:pk>/unban/", SetActiveView.as_view(active=True)),
    path("role-permissions/", RolePermissionView.as_view()),
]
