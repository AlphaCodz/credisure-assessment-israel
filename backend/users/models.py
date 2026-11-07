from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        ANALYST = "analyst", "Analyst"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ANALYST)

    def has_app_permission(self, codename):
        if self.is_superuser:
            return True
        return RolePermission.objects.filter(role=self.role, codename=codename).exists()


class AppPermission(models.TextChoices):
    CREATE_USERS = "create_users", "Create users"
    EDIT_USERS = "edit_users", "Edit user details"
    BAN_USERS = "ban_users", "Ban and unban users"
    ASSIGN_ROLES = "assign_roles", "Change user roles"
    MANAGE_ADMINS = "manage_admins", "Create, edit and ban admin accounts"
    MANAGE_PERMISSIONS = "manage_permissions", "Change role permissions"


class RolePermission(models.Model):
    role = models.CharField(max_length=20, choices=User.Role.choices)
    codename = models.CharField(max_length=40, choices=AppPermission.choices)

    class Meta:
        unique_together = ("role", "codename")

    def __str__(self):
        return f"{self.role}: {self.codename}"
