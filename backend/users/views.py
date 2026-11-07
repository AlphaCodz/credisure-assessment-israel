import hashlib

from django.core.cache import cache
from rest_framework import filters, generics
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.serializers import AuthTokenSerializer
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import AppPermission, RolePermission, User
from .serializers import RolePermissionSerializer, UserSerializer
from .tasks import CACHE_TTL, DASHBOARD_KEY, USERS_VERSION_KEY, dashboard_payload


class HasAppPermission(BasePermission):
    """Reads need a logged-in user. Writes need the permission named in view.write_permissions."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        codename = view.write_permissions.get(request.method)
        return codename is not None and request.user.has_app_permission(codename)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = AuthTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "username": user.username})


class MeView(APIView):
    permission_classes = [HasAppPermission]

    def get(self, request):
        user = request.user
        codes = [p.value for p in AppPermission if user.has_app_permission(p.value)]
        return Response({
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "permissions": codes,
        })


class DashboardView(APIView):
    permission_classes = [HasAppPermission]

    def get(self, request):
        data = cache.get(DASHBOARD_KEY)
        if data is not None:
            return Response(data, headers={"X-Cache": "HIT"})
        data = dashboard_payload()
        cache.set(DASHBOARD_KEY, data, CACHE_TTL)
        return Response(data, headers={"X-Cache": "MISS"})


class UserPagination(PageNumberPagination):
    page_size = 10


class UserListView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [HasAppPermission]
    pagination_class = UserPagination
    write_permissions = {"POST": AppPermission.CREATE_USERS}
    filter_backends = [filters.SearchFilter]
    search_fields = ["username", "first_name", "last_name", "email"]

    def get_queryset(self):
        users = User.objects.order_by("-date_joined")
        role = self.request.query_params.get("role")
        status = self.request.query_params.get("status")
        if role:
            users = users.filter(role=role)
        if status:
            users = users.filter(is_active=status == "active")
        return users

    def list(self, request, *args, **kwargs):
        url_hash = hashlib.md5(request.build_absolute_uri().encode()).hexdigest()
        key = f"users:{cache.get(USERS_VERSION_KEY, 0)}:{url_hash}"
        data = cache.get(key)
        if data is not None:
            return Response(data, headers={"X-Cache": "HIT"})
        response = super().list(request, *args, **kwargs)
        cache.set(key, response.data, CACHE_TTL)
        response["X-Cache"] = "MISS"
        return response


class UserDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [HasAppPermission]
    write_permissions = {"PUT": AppPermission.EDIT_USERS, "PATCH": AppPermission.EDIT_USERS}
    queryset = User.objects.all()


class SetActiveView(APIView):
    """Ban (active=False) or unban (active=True) a user. Mounted twice in urls.py."""

    active = False
    permission_classes = [HasAppPermission]
    write_permissions = {"POST": AppPermission.BAN_USERS}

    def post(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        if user.pk == request.user.pk:
            raise ValidationError("You cannot ban or unban yourself.")
        if user.role == User.Role.ADMIN and not request.user.has_app_permission(AppPermission.MANAGE_ADMINS):
            raise PermissionDenied("You do not have permission to ban admin accounts.")
        user.is_active = self.active
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user).data)


def _permissions_by_role():
    data = {role: [] for role in User.Role.values}
    for row in RolePermission.objects.order_by("codename"):
        data[row.role].append(row.codename)
    return data


class RolePermissionView(APIView):
    permission_classes = [HasAppPermission]
    write_permissions = {"PUT": AppPermission.MANAGE_PERMISSIONS}

    def get(self, request):
        return Response({"roles": _permissions_by_role(), "all_permissions": AppPermission.values})

    def put(self, request):
        serializer = RolePermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"roles": _permissions_by_role(), "all_permissions": AppPermission.values})
