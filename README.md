# Filmanma

Persian cinema academy platform. Next.js frontend + NestJS API + PostgreSQL.

## Layout

- `./` — Next.js frontend (deployed on Vercel)
- `./backend` — NestJS API (runs on a persistent Node host: VPS / Render / Railway / Liara)
- `./docker-compose.yml` — local dev stack (postgres + redis + backend + frontend)

## Local development

1. Copy `.env.example` to `.env` and fill secrets (never commit `.env`).
2. `docker compose up --build` (postgres :55432, redis :56379, backend :4000, frontend :3000).
3. Backend: `npm run migrate:deploy`, then create the admin:
   `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin` (from `./backend`).
4. Seed demo content: `SEED_DEVELOPMENT=true npm run seed:dev` (dev only).

## Environment variables

Frontend (Vercel): `SITE_URL`, `BACKEND_API_URL`, `FILMNAMA_CONTENT_SOURCE=api`,
`NEXT_REVALIDATE_SECRET` (must match the backend value).

Backend (host): `NODE_ENV`, `LOCAL_POSTGRES_ONLY`, `PORT`, `DATABASE_URL`
(direct connection, with `?schema=public`), `REDIS_URL`, `JWT_SECRET`,
`JWT_ISSUER`, `JWT_AUDIENCE`, `CSRF_SECRET`, `ALLOWED_ORIGINS` (frontend
origin(s) only), `NEXT_REVALIDATE_URL`, `NEXT_REVALIDATE_SECRET`, `TRUST_PROXY`,
`ADMIN_IP_ALLOWLIST`, `SWAGGER_ENABLED`, `MEDIA_DIR`, plus optional
`BLOB_READ_WRITE_TOKEN` (external object storage) and `CRON_SECRET`
(external scheduler hitting `POST /api/v1/internal/revalidation/drain`).

CLI-only: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (create-admin), `SEED_DEVELOPMENT`.

## Production deploy

- **Frontend:** import the repo on Vercel (root directory = repo root), set the
  four frontend env vars above, deploy. Point DNS for the final domain there.
- **Backend:** deploy `./backend` as a persistent Node service
  (`npm ci`, `npx prisma migrate deploy` — never db push — then
  `node dist/src/main.js`; the Dockerfile does migrate+start). Set all backend
  env vars. CORS allows only the frontend origin.
- **Database:** managed Postgres (e.g. Neon/Supabase/Aiven). Run migrations
  only with the project's migrate tool against the direct connection string.
- **Uploads:** files are stored under `MEDIA_DIR` by default — mount a
  persistent volume on the host, or set `BLOB_READ_WRITE_TOKEN` to use
  external object storage. Ephemeral disks lose uploads on redeploy.
- **Health:** backend exposes `GET /api/v1/health/live`; the compose file
  already healthchecks backend → frontend ordering.

## CI

`.github/workflows/ci.yml` runs backend (typecheck via build, tests incl.
Postgres integration, lint) and frontend (typecheck, tests, lint) on push/PR.
