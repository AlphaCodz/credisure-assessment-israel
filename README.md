# Admin Dashboard

A small dashboard built with Django REST Framework and Next.js with Tailwind CSS.

## Local development

### Backend (http://localhost:8000)

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata users
python manage.py runserver
```

Or run Django, a Celery worker and Redis in Docker with code reload:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec web python manage.py loaddata users
```

Without Docker, Django uses an in-memory cache and runs Celery tasks inline.

### Frontend (http://localhost:3000)

```
cd frontend
npm install
npm run dev
```

Sign in with `admin` / `admin12345`. These are demo accounts: never load the `users` fixture in production.

### Tests

```
cd backend
python manage.py test users
```

## Deployment

### Backend

The API must sit behind an HTTPS proxy or platform load balancer that sets `X-Forwarded-Proto`. Plain HTTP requests are redirected to HTTPS.

1. Copy `.env.example` to `.env` and fill it in. The app will not start without `DJANGO_SECRET_KEY`.
2. Start the stack, which runs migrations on startup:

   ```
   docker compose up -d --build
   ```

3. Create your first admin:

   ```
   docker compose exec web python manage.py createsuperuser
   ```

SQLite data lives in the `db_data` Docker volume, so this setup runs on a single server. Back up that volume.

### Frontend

Deploy `frontend` to any Next.js host. Set this before building, because it is compiled into the app:

```
NEXT_PUBLIC_API_URL=https://api.example.com/api
```

Add the frontend's address to `CORS_ALLOWED_ORIGINS` in the backend's `.env`.

## Caching

`/api/dashboard/` and `/api/users/` are cached in Redis for 60 seconds, and any change to a user clears the cache straight away. Celery then rebuilds the overview in the background. Responses carry an `X-Cache: HIT` or `MISS` header. Redis sits on an internal Docker network and is not reachable from the host.

## API

All endpoints except login need an `Authorization: Token <token>` header.

| Method    | Path                     | Purpose                                                 | Needs permission     |
| --------- | ------------------------ | ------------------------------------------------------- | -------------------- |
| POST      | `/api/login/`            | Returns a token; limited to 10 attempts a minute        | none                 |
| GET       | `/api/me/`               | Signed-in user's role and permissions                   | any logged-in user   |
| GET       | `/api/dashboard/`        | Overview counts and recent users                        | any logged-in user   |
| GET       | `/api/users/`            | 10 users per page; `?page=`, `?search=`, `?role=`, `?status=` | any logged-in user |
| POST      | `/api/users/`            | Create a user                                           | `create_users`       |
| GET       | `/api/users/<id>/`       | One user                                                | any logged-in user   |
| PUT/PATCH | `/api/users/<id>/`       | Edit details; role changes need `assign_roles`          | `edit_users`         |
| POST      | `/api/users/<id>/ban/`   | Ban a user                                              | `ban_users`          |
| POST      | `/api/users/<id>/unban/` | Unban a user                                            | `ban_users`          |
| GET       | `/api/role-permissions/` | Permissions for each role                               | any logged-in user   |
| PUT       | `/api/role-permissions/` | Replace one role's permissions: `{role, permissions}`   | `manage_permissions` |

Admin accounts (creating, editing, changing or banning them) also need `manage_admins`. Admins have all permissions by default. Superusers bypass these checks.
