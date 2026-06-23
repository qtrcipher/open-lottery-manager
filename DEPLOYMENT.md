# Deployment Guide

This guide covers a small self-hosted production deployment using Docker Compose. Open Lottery Manager is software only; operators remain responsible for legal review, data protection, backups, and monitoring.

## Production Setup

Use a tagged release instead of deploying an arbitrary branch:

```bash
git clone https://github.com/qtrcipher/open-lottery-manager.git
cd open-lottery-manager
git fetch --tags
RELEASE=v0.1.19
git checkout "$RELEASE"
cp .env.example .env
npm install
npm run hash-password -- "replace-with-a-strong-password"
```

Edit `.env` before starting:

- `AUTH_SECRET`: a random value with at least 24 characters.
- `ADMIN_EMAIL`: the operator admin login email.
- `ADMIN_PASSWORD_HASH`: the generated password hash.
- `PUBLIC_APP_URL`: public HTTPS URL for admin system status, deployment checks, and outbound ticket lookup links. Required for production ticket receipt links when SMTP is configured.
- `TRUST_PROXY_HEADERS`: set to `true` only when a trusted proxy controls `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.
- SMTP variables: optional ticket receipt email settings. Leave empty to disable email.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: optional Cloudflare Turnstile challenge for public entries.

Start the app:

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app
```

Open `http://localhost:3000/admin/login` or the public URL routed through your reverse proxy. The production Compose template overrides `DATABASE_URL` to `file:/app/data/prod.db`, runs `npx prisma db push --accept-data-loss`, and starts Next.js on port `3000`. Back up the SQLite database before upgrades because Prisma may need to rebuild SQLite tables when constraints change.

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

The endpoint returns JSON with app status, package version, uptime, configured public URL, timestamp, and database connectivity. A healthy response uses HTTP `200`; a database connectivity failure uses HTTP `503`.

Check core pages with the E2E smoke test:

```bash
npm run smoke:e2e -- http://localhost:3000
```

If demo data is loaded with `npm run db:seed`, require the demo campaign pages too:

```bash
npm run smoke:e2e -- http://localhost:3000 --require-demo
```

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

The admin dashboard Backup readiness panel summarizes these expectations and links back to this guide. It is informational only: it does not inspect backup files, expose database files, or run backup and restore commands from the browser.

## Reverse Proxy And HTTPS

Terminate HTTPS at a trusted reverse proxy such as Caddy, Nginx, Traefik, or a managed edge service. Forward traffic to the app on port `3000`.

Configure the proxy to:

- enforce HTTPS and redirect HTTP to HTTPS,
- set reasonable request body limits for CSV imports,
- send only trusted client IP headers,
- preserve `Host` and protocol headers, and
- restrict access to the admin URL if your operating model requires it.

Public entry, ticket lookup, and admin login rate limits ignore forwarded IP headers by default. Set `TRUST_PROXY_HEADERS=true` only when the app is behind a proxy or edge service that strips client-supplied forwarding headers and sets trusted `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip` values.

Reverse proxies and load balancers can use `/api/health` for readiness checks. The endpoint is unauthenticated and intentionally exposes only basic status, version, timestamp, and database connectivity.

The app emits baseline browser security headers on every route, including Content Security Policy, frame blocking, content-type sniffing protection, referrer policy, permissions policy, and production HSTS. Preserve these headers at the reverse proxy unless you intentionally replace them with an equivalent or stricter policy. The default CSP keeps inline script/style support for Next.js rendering, allows Cloudflare Turnstile challenge origins, and does not allow `unsafe-eval`. If you customize the policy, retest admin pages, public entry forms, ticket lookup, exports, Turnstile, and operator logo URLs.

## Optional Email And Turnstile

The app does not send email unless SMTP is configured. When SMTP is configured, public entry ticket receipts are sent after successful entry creation. Set `PUBLIC_APP_URL` to the public HTTPS origin before enabling SMTP in production; the app does not build receipt links from untrusted request host headers. Delivery failures or missing production link configuration are recorded in the audit log but do not invalidate the entry.

Turnstile is disabled unless `TURNSTILE_SECRET_KEY` is set. Set both the public site key and secret key to show and verify the widget on public entry forms. Keep `TRUST_PROXY_HEADERS=false` unless a trusted proxy controls forwarded IP headers.

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
TARGET_VERSION=v0.1.19
git checkout "$TARGET_VERSION"
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app
```

After upgrade, verify:

- `docker compose -f docker-compose.prod.yml ps` shows the app service as healthy,
- `npm run smoke:deploy -- http://localhost:3000` passes,
- `npm run smoke:e2e -- http://localhost:3000` passes,
- admin login works,
- campaign lists load,
- public campaign pages load,
- public entry and ticket lookup still work on a test campaign, including reference-required lookup if enabled, and
- recent audit logs and completed draw records are still present,
- new completed draws expose `/campaigns/[slug]/verify/bundle.json` and pass `npm run verify:draw -- bundle.json`, and
- downloaded verification bundles use public entry keys and prize keys, not database IDs.

## Troubleshooting

If the app does not start, inspect the app logs first:

```bash
docker compose -f docker-compose.prod.yml logs app
```

- Missing or invalid environment values: confirm `.env` contains `AUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH`. Regenerate the password hash with `npm run hash-password -- "your-password"` if login fails.
- Database startup or Prisma errors: confirm the `lottery-data` volume exists, the app can write to `/app/data`, and the production Compose file is setting `DATABASE_URL=file:/app/data/prod.db`.
- Unhealthy container: run `curl http://localhost:3000/api/health`. HTTP `503` means the app is serving requests but the database check is failing.
- Failed smoke test: verify the URL passed to `npm run smoke:deploy -- <url>` is reachable from the host running the command and points to this app, not only to the reverse proxy.
- Backup failure: confirm Docker is running, the production Compose project can stop/start the `app` service, and `/app/data/prod.db` exists before running `npm run backup`.
- Restore failure: use only files directly inside `backups/` with the `prod-YYYYMMDD-HHMMSS.db` naming pattern, and include `--confirm`.
- Public rate limits not behaving as expected: set `TRUST_PROXY_HEADERS=true` only behind a trusted reverse proxy; otherwise the app intentionally ignores forwarded IP headers.
- Ticket receipts not sending: confirm `SMTP_HOST`, `SMTP_FROM`, credentials, and provider firewall settings. Entries still succeed when receipt delivery fails.
- Ticket receipts missing lookup links in production: set `PUBLIC_APP_URL` to the public HTTPS origin and retry with a new public entry.
- Turnstile challenge failing: confirm both Turnstile env vars are set and the browser can load `https://challenges.cloudflare.com`.

## Before Accepting Public Entries

- Confirm legal, tax, age, prize, advertising, and licensing requirements.
- Replace demo campaign rules with operator-approved rules.
- Configure `/admin/settings` with public operator name and support email.
- Use a strong admin password and keep `.env` private.
- Confirm database backups and restore steps.
- Confirm HTTPS and trusted proxy header configuration.
- Require references for public entry and ticket lookup when email-only lookup is not strong enough for the campaign.
- Confirm `docker compose -f docker-compose.prod.yml ps` shows the app service as healthy.
- Confirm `npm run smoke:deploy -- http://localhost:3000` passes.
- Confirm `npm run smoke:e2e -- http://localhost:3000` passes.
- Run a test campaign and draw before using real participant data.

Use [RUNBOOK.md](RUNBOOK.md) for launch, live-campaign, pre-draw, post-draw, backup drill, and incident checklists.
