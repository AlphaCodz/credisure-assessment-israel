from django.db import migrations

ADMIN_PERMISSIONS = [
    "create_users",
    "edit_users",
    "ban_users",
    "assign_roles",
    "manage_admins",
    "manage_permissions",
]


def grant_admin_permissions(apps, schema_editor):
    RolePermission = apps.get_model("users", "RolePermission")
    for codename in ADMIN_PERMISSIONS:
        RolePermission.objects.get_or_create(role="admin", codename=codename)


def revoke_admin_permissions(apps, schema_editor):
    RolePermission = apps.get_model("users", "RolePermission")
    RolePermission.objects.filter(role="admin", codename__in=ADMIN_PERMISSIONS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_role_permissions"),
    ]

    operations = [
        migrations.RunPython(grant_admin_permissions, revoke_admin_permissions),
    ]
