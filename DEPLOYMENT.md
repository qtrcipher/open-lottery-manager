# Deployment Guide

This guide covers a small self-hosted production deployment using Docker Compose. Open Lottery Manager is software only; operators remain responsible for legal review, data protection, backups, and monitoring.

## Production Setup

Use a tagged release instead of deploying an arbitrary branch:

```bash
git clone https://github.com/qtrcipher/open-lottery-manager.git
cd open-lottery-manager
git fetch --tags
RELEASE=v0.1.3
git checkout "$RELEASE"
cp .env.example .env
npm install
npm run hash-password -- "replace-with-a-strong-password"
```

Edit `.env` before starting:

- `AUTH_SECRET`: a random value with at least 24 characters.
- `ADMIN_EMAIL`: the operator admin login email.
- `ADMIN_PASSWORD_HASH`: the generated password hash.

Start the app:

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app
```

Open `http://localhost:3000/admin/login` or the public URL routed through your reverse proxy. The production Compose template overrides `DATABASE_URL` to `file:/app/data/prod.db`, runs `npx prisma db push`, and starts Next.js on port `3000`.

Check container health:

```bash
docker compose -f docker-compose.prod.yml ps
```

The app service uses `/api/health` for its container healthcheck. A healthy container means the Next.js process is serving requests and the SQLite database check succeeds.

Check runtime health:

```bash
npm run smoke:deploy -- http://localhost:3000
```

The smoke test calls `/api/health` and verifies HTTP `200`, app status `ok`, and database status `ok`. To inspect the raw response manually, run:

```bash
curl http://localhost:3000/api/health
```

The endpoint returns JSON with app status, package version, timestamp, and database connectivity. A healthy response uses HTTP `200`; a database connectivity failure uses HTTP `503`.

## Data Persistence

Campaign, entry, prize, draw, audit, settings, and rate-limit records are stored in SQLite at `/app/data/prod.db` inside the container. Docker Compose persists `/app/data` in the named volume declared as `lottery-data`.

Docker may prefix the actual volume name with the project directory, such as `lottery_lottery-data`. Confirm the name with:

```bash
docker volume ls | grep lottery
```

## Backup And Restore

Back up the SQLite database with the helper script:

```bash
npm run backup
```

The script stops the production app if it is running, copies `/app/data/prod.db` from the Docker volume to `backups/prod-YYYYMMDD-HHMMSS.db`, verifies the backup is non-empty, and restarts the app if it stopped it.

Restore from a backup:

```bash
npm run restore -- backups/prod-YYYYMMDD-HHMMSS.db --confirm
```

The restore script accepts only non-empty `backups/prod-YYYYMMDD-HHMMSS.db` files, stops the production app if it is running, replaces `/app/data/prod.db`, and restarts the app if it stopped it.

Always test restore steps on a copy before relying on them for production.

## Reverse Proxy And HTTPS

Terminate HTTPS at a trusted reverse proxy such as Caddy, Nginx, Traefik, or a managed edge service. Forward traffic to the app on port `3000`.

Configure the proxy to:

- enforce HTTPS and redirect HTTP to HTTPS,
- set reasonable request body limits for CSV imports,
- send only trusted client IP headers,
- preserve `Host` and protocol headers, and
- restrict access to the admin URL if your operating model requires it.

Public entry and ticket lookup rate limits read client identity from `x-forwarded-for`, `x-real-ip`, then `cf-connecting-ip`. Only allow your trusted proxy to set those headers; otherwise clients can spoof IP identity and weaken rate limiting.

Reverse proxies and load balancers can use `/api/health` for readiness checks. The endpoint is unauthenticated and intentionally exposes only basic status, version, timestamp, and database connectivity.

## Upgrade Workflow

Before upgrading:

```bash
git fetch --tags
git tag --sort=version:refname | tail
```

Upgrade to a new release:

```bash
docker compose -f docker-compose.prod.yml stop app
# Run the backup command above before changing versions.
TARGET_VERSION=v0.1.3
git checkout "$TARGET_VERSION"
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app
```

After upgrade, verify:

- `docker compose -f docker-compose.prod.yml ps` shows the app service as healthy,
- `npm run smoke:deploy -- http://localhost:3000` passes,
- admin login works,
- campaign lists load,
- public campaign pages load,
- public entry and ticket lookup still work on a test campaign, and
- recent audit logs and completed draw records are still present.

## Before Accepting Public Entries

- Confirm legal, tax, age, prize, advertising, and licensing requirements.
- Replace demo campaign rules with operator-approved rules.
- Configure `/admin/settings` with public operator name and support email.
- Use a strong admin password and keep `.env` private.
- Confirm database backups and restore steps.
- Confirm HTTPS and trusted proxy headers.
- Confirm `docker compose -f docker-compose.prod.yml ps` shows the app service as healthy.
- Confirm `npm run smoke:deploy -- http://localhost:3000` passes.
- Run a test campaign and draw before using real participant data.
