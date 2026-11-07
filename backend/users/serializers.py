from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import AppPermission, RolePermission, User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="get_full_name", read_only=True)
    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})

    class Meta:
        model = User
        fields = [
            "id", "username", "name", "first_name", "last_name", "email",
            "role", "is_active", "date_joined", "password",
        ]
        read_only_fields = ["is_active", "date_joined"]

    def validate(self, attrs):
        actor = self.context["request"].user
        instance = self.instance
        current_role = instance.role if instance else User.Role.ANALYST
        new_role = attrs.get("role", current_role)

        if instance is None and not attrs.get("password"):
            raise ValidationError({"password": "A password is required for new users."})
        if attrs.get("password"):
            validate_password(attrs["password"], user=instance)

        if User.Role.ADMIN in (current_role, new_role) and not actor.has_app_permission(AppPermission.MANAGE_ADMINS):
            raise PermissionDenied("You do not have permission to manage admin accounts.")

        if new_role != current_role:
            if not actor.has_app_permission(AppPermission.ASSIGN_ROLES):
                raise PermissionDenied("You do not have permission to change user roles.")
            if instance and instance.pk == actor.pk:
                raise ValidationError({"role": "You cannot change your own role."})

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RolePermissionSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)
    permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=AppPermission.choices),
        allow_empty=True,
    )

    def validate(self, attrs):
        if attrs["role"] == User.Role.ADMIN and AppPermission.MANAGE_PERMISSIONS not in attrs["permissions"]:
            raise ValidationError(
                {"permissions": "The admin role must keep 'manage_permissions', or nobody could change permissions."}
            )
        return attrs

    def save(self):
        role = self.validated_data["role"]
        RolePermission.objects.filter(role=role).delete()
        RolePermission.objects.bulk_create(
            RolePermission(role=role, codename=codename)
            for codename in self.validated_data["permissions"]
        )
        return role
