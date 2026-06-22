# Deployment Guide

This guide covers a small self-hosted production deployment using Docker Compose. Open Lottery Manager is software only; operators remain responsible for legal review, data protection, backups, and monitoring.

## Production Setup

Use a tagged release instead of deploying an arbitrary branch:

```bash
git clone https://github.com/qtrcipher/open-lottery-manager.git
cd open-lottery-manager
git fetch --tags
RELEASE=v0.1.1
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
docker compose up --build -d
docker compose logs -f app
```

Open `http://localhost:3000/admin/login` or the public URL routed through your reverse proxy. The Compose service overrides `DATABASE_URL` to `file:/app/data/prod.db`, runs `npx prisma db push`, and starts Next.js on port `3000`.

Check runtime health:

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

Create a local backup directory:

```bash
mkdir -p backups
```

Back up the SQLite database while the app is stopped:

```bash
docker compose stop app
docker run --rm \
  -v lottery_lottery-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cp /data/prod.db "/backup/prod-$(date +%Y%m%d-%H%M%S).db"'
docker compose up -d
```

If your volume name differs, replace `lottery_lottery-data` with the name from `docker volume ls`.

Restore from a backup:

```bash
docker compose stop app
docker run --rm \
  -v lottery_lottery-data:/data \
  -v "$PWD/backups:/backup:ro" \
  alpine sh -c 'cp /backup/prod-YYYYMMDD-HHMMSS.db /data/prod.db'
docker compose up -d
```

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
docker compose stop app
# Run the backup command above before changing versions.
TARGET_VERSION=v0.1.2
git checkout "$TARGET_VERSION"
docker compose up --build -d
docker compose logs -f app
```

After upgrade, verify:

- `curl http://localhost:3000/api/health` returns HTTP `200`,
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
- Confirm `/api/health` returns HTTP `200`.
- Run a test campaign and draw before using real participant data.
