import time

from celery import shared_task
from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import User
from .serializers import UserSerializer

CACHE_TTL = 60
DASHBOARD_KEY = "dashboard"
USERS_VERSION_KEY = "users_version"


def dashboard_payload():
    users = User.objects.all()
    return {
        "total": users.count(),
        "active": users.filter(is_active=True).count(),
        "inactive": users.filter(is_active=False).count(),
        "admins": users.filter(role=User.Role.ADMIN).count(),
        "recent": UserSerializer(users.order_by("-date_joined")[:5], many=True).data,
    }


@shared_task
def refresh_dashboard_cache():
    cache.set(DASHBOARD_KEY, dashboard_payload(), CACHE_TTL)


def invalidate_user_caches():
    # Done here, not in the task, so the next read after a write is never stale.
    cache.delete(DASHBOARD_KEY)
    cache.set(USERS_VERSION_KEY, time.time_ns(), None)
    refresh_dashboard_cache.delay()


@receiver([post_save, post_delete], sender=User)
def user_changed(sender, update_fields=None, **kwargs):
    if update_fields and set(update_fields) == {"last_login"}:
        return
    transaction.on_commit(invalidate_user_caches)
