from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import AppPermission, RolePermission, User


class LoginThrottleTests(TestCase):
    def test_login_is_rate_limited(self):
        cache.clear()
        client = APIClient()
        for _ in range(10):
            self.assertEqual(client.post("/api/login/", {}, format="json").status_code, 400)
        self.assertEqual(client.post("/api/login/", {}, format="json").status_code, 429)


class CacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user("boss3", password="Strong-pass-123", role=User.Role.ADMIN)
        self.target = User.objects.create(username="target3")
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get_or_create(user=self.admin)[0].key}")

    def test_second_read_is_served_from_cache(self):
        for path in ("/api/dashboard/", "/api/users/"):
            self.assertEqual(self.client.get(path).headers["X-Cache"], "MISS")
            self.assertEqual(self.client.get(path).headers["X-Cache"], "HIT")

    def test_write_is_visible_on_the_next_read(self):
        self.client.get("/api/users/")
        self.client.get("/api/dashboard/")
        # A real worker would read the real database, not this test's one.
        with patch("users.tasks.refresh_dashboard_cache.delay"), self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/users/{self.target.pk}/ban/")
        self.assertEqual(response.status_code, 200)

        users = self.client.get("/api/users/").json()["results"]
        self.assertFalse(next(u for u in users if u["id"] == self.target.pk)["is_active"])
        self.assertEqual(self.client.get("/api/dashboard/").json()["inactive"], 1)

    def test_cached_responses_still_need_a_login(self):
        self.client.get("/api/users/")
        self.client.get("/api/dashboard/")
        self.assertEqual(APIClient().get("/api/users/").status_code, 401)
        self.assertEqual(APIClient().get("/api/dashboard/").status_code, 401)

    def test_different_filters_are_cached_separately(self):
        self.client.get("/api/users/")
        response = self.client.get("/api/users/?role=admin")
        self.assertEqual(response.headers["X-Cache"], "MISS")
        self.assertEqual(response.json()["count"], 1)


class PaginationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user("boss2", password="Strong-pass-123", role=User.Role.ADMIN)
        # 14 more users, 15 in total. No passwords here, which keeps the tests fast.
        User.objects.bulk_create(User(username=f"u{i}", email=f"u{i}@example.com") for i in range(14))
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get_or_create(user=self.admin)[0].key}")

    def test_first_page_has_10_users(self):
        data = self.client.get("/api/users/").json()
        self.assertEqual(data["count"], 15)
        self.assertEqual(len(data["results"]), 10)
        self.assertIsNotNone(data["next"])
        self.assertIsNone(data["previous"])

    def test_second_page_has_the_rest_without_overlap(self):
        first_ids = {u["id"] for u in self.client.get("/api/users/").json()["results"]}
        second = self.client.get("/api/users/?page=2").json()
        self.assertEqual(len(second["results"]), 5)
        self.assertIsNone(second["next"])
        self.assertFalse(first_ids & {u["id"] for u in second["results"]})

    def test_filters_apply_before_paging(self):
        data = self.client.get("/api/users/?role=admin").json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(len(data["results"]), 1)


class PermissionTests(TestCase):
    def setUp(self):
        cache.clear()
        # The data migration gives the admin role every permission.
        self.admin = User.objects.create_user("boss", password="Strong-pass-123", role=User.Role.ADMIN)
        self.manager = User.objects.create_user("mgr", password="Strong-pass-123", role=User.Role.MANAGER)
        self.analyst = User.objects.create_user("ana", password="Strong-pass-123", role=User.Role.ANALYST)
        self.target = User.objects.create_user("target", password="Strong-pass-123", role=User.Role.ANALYST)

    def client_for(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get_or_create(user=user)[0].key}")
        return client

    def new_user_payload(self, **extra):
        return {"username": "newbie", "password": "Strong-pass-123", "email": "n@example.com", **extra}

    def test_admin_can_create_user(self):
        response = self.client_for(self.admin).post("/api/users/", self.new_user_payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="newbie").exists())

    def test_password_format_is_enforced(self):
        response = self.client_for(self.admin).post(
            "/api/users/", self.new_user_payload(password="weakpassword"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        errors = " ".join(response.data["password"])
        for part in ("uppercase", "number", "symbol"):
            self.assertIn(part, errors)

    def test_manager_and_analyst_cannot_create_users(self):
        for user in (self.manager, self.analyst):
            response = self.client_for(user).post("/api/users/", self.new_user_payload(username=f"x{user.pk}"), format="json")
            self.assertEqual(response.status_code, 403)

    def test_creating_admin_needs_manage_admins(self):
        RolePermission.objects.create(role="manager", codename=AppPermission.CREATE_USERS)
        RolePermission.objects.create(role="manager", codename=AppPermission.ASSIGN_ROLES)
        client = self.client_for(self.manager)

        ok = client.post("/api/users/", self.new_user_payload(username="a1", role="analyst"), format="json")
        self.assertEqual(ok.status_code, 201)

        denied = client.post("/api/users/", self.new_user_payload(username="a2", role="admin"), format="json")
        self.assertEqual(denied.status_code, 403)

    def test_role_change_needs_assign_roles(self):
        RolePermission.objects.create(role="manager", codename=AppPermission.EDIT_USERS)
        response = self.client_for(self.manager).patch(
            f"/api/users/{self.target.pk}/", {"role": "manager"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_edit_details_without_role_change(self):
        RolePermission.objects.create(role="manager", codename=AppPermission.EDIT_USERS)
        response = self.client_for(self.manager).patch(
            f"/api/users/{self.target.pk}/", {"first_name": "Tee"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.first_name, "Tee")

    def test_ban_blocks_login_and_existing_token(self):
        token = Token.objects.get_or_create(user=self.target)[0]
        response = self.client_for(self.admin).post(f"/api/users/{self.target.pk}/ban/")
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)

        old_token = APIClient()
        old_token.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(old_token.get("/api/me/").status_code, 401)

        login = APIClient().post("/api/login/", {"username": "target", "password": "Strong-pass-123"}, format="json")
        self.assertEqual(login.status_code, 400)

    def test_cannot_ban_yourself(self):
        response = self.client_for(self.admin).post(f"/api/users/{self.admin.pk}/ban/")
        self.assertEqual(response.status_code, 400)

    def test_ban_admin_needs_manage_admins(self):
        RolePermission.objects.create(role="manager", codename=AppPermission.BAN_USERS)
        response = self.client_for(self.manager).post(f"/api/users/{self.admin.pk}/ban/")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_grant_and_remove_permissions_per_role(self):
        client = self.client_for(self.admin)
        response = client.put(
            "/api/role-permissions/",
            {"role": "manager", "permissions": ["ban_users", "edit_users"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["roles"]["manager"], ["ban_users", "edit_users"])

        response = self.client_for(self.manager).post(f"/api/users/{self.target.pk}/ban/")
        self.assertEqual(response.status_code, 200)

    def test_admin_role_must_keep_manage_permissions(self):
        response = self.client_for(self.admin).put(
            "/api/role-permissions/",
            {"role": "admin", "permissions": ["create_users"]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_superuser_bypasses_checks(self):
        su = User.objects.create_superuser("root", "root@example.com", "Strong-pass-123", role=User.Role.ANALYST)
        response = self.client_for(su).post("/api/users/", self.new_user_payload(username="byroot"), format="json")
        self.assertEqual(response.status_code, 201)
