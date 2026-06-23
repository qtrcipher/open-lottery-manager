# Open Lottery Manager

[![CI](https://github.com/qtrcipher/open-lottery-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/qtrcipher/open-lottery-manager/actions/workflows/ci.yml)
[![CodeQL](https://github.com/qtrcipher/open-lottery-manager/actions/workflows/codeql.yml/badge.svg)](https://github.com/qtrcipher/open-lottery-manager/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://github.com/qtrcipher/open-lottery-manager/actions/workflows/scorecard.yml/badge.svg)](https://github.com/qtrcipher/open-lottery-manager/actions/workflows/scorecard.yml)
[![Latest Release](https://img.shields.io/github/v/release/qtrcipher/open-lottery-manager?label=release)](https://github.com/qtrcipher/open-lottery-manager/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Open Lottery Manager is a self-hosted web app for lawful prize campaigns, raffles, promotional draws, and licensed lottery-style operations. It gives operators public campaign pages, participant entry and lookup flows, an admin dashboard, auditable winner selection, CSV exports, backups, and deployment health checks.

This project is software only. Operators are responsible for complying with all applicable licensing, age, tax, prize, advertising, consumer protection, and gambling laws in the places where they use it.

## At A Glance

- Public campaign pages with structured disclosures, rules, prizes, entry status, ticket lookup, and draw records.
- Admin tools for campaigns, participants, participant review, prizes, CSV import/export, audit logs, branding, and operations links.
- Auditable draws with revealed seeds, frozen entry manifests, verification bundles, algorithm version, ordered winners, and export-friendly records.
- Self-hosting support with Docker Compose, SQLite persistence, backup/restore helpers, runtime health checks, proxy-aware rate limits, and smoke tests.
- GitHub Actions for tests, lint, build, Docker validation, dependency audit, CodeQL, Scorecard, release validation, and E2E smoke checks.

## Screenshots

![Public home showing the demo campaign](docs/screenshots/public-home.png)

![Admin dashboard listing campaigns](docs/screenshots/admin-dashboard.png)

![Admin campaign management screen](docs/screenshots/campaign-management.png)

![Public draw results with winners and seed hash](docs/screenshots/public-results.png)

## What This Is

- A free, self-hosted campaign manager for operators who already know their promotion is lawful.
- A Next.js, Prisma, SQLite, and Docker app that can be run on your own infrastructure.
- A tool for managing entries, prizes, public campaign pages, draw records, and CSV exports.

## What This Is Not

- Not a hosted lottery service, payment processor, wallet, KYC provider, or compliance product.
- Not legal advice and not a substitute for licensing, regulatory review, or independent auditing.
- Not designed for real-money gambling without additional controls and jurisdiction-specific review.

## Features

- Campaign setup with public rules, dates, and status.
- Fixed prize lists with one or more winners.
- Public participant entry forms, manual entry creation, and CSV import.
- Public entry abuse controls with rate limits, honeypots, optional Turnstile, and admin review status.
- Optional SMTP ticket receipts for public entries.
- Auditable draws using server-side cryptographic randomness, frozen manifests, revealed seeds, and offline replay.
- Public results pages with seed hashes, manifest hashes, bundle hashes, and algorithm version.
- Operator branding settings for name, tagline, support email, logo URL, and primary color.
- Single-admin authentication for small self-hosted deployments.
- SQLite persistence through Prisma.

## Quick Start

```bash
npm install
cp .env.example .env
npm run hash-password -- "change-me"
npm run db:push
npm run db:seed
npm run dev
```

Update `.env` with the generated `ADMIN_PASSWORD_HASH`, a strong `AUTH_SECRET`, and your admin email before signing in. Then open `http://localhost:3000` for the public demo or `http://localhost:3000/admin/login` for the admin dashboard.

## Demo Data

Load a professional sample campaign with prizes, entries, completed draw results, and audit records:

```bash
npm run db:seed
```

The seed is idempotent and only replaces the fixed demo campaign at `/campaigns/demo-summer-rewards`.

## Run With Docker

Docker Compose is the recommended self-hosting path for small deployments. It stores SQLite data in a named volume so campaign and draw records survive container restarts.

```bash
git clone https://github.com/qtrcipher/open-lottery-manager.git
cd open-lottery-manager
cp .env.example .env
npm install
npm run hash-password -- "change-me"
```

Update `.env` with:

- `AUTH_SECRET`: a long random value.
- `ADMIN_EMAIL`: the admin login email.
- `ADMIN_PASSWORD_HASH`: the generated password hash.

Optional settings include SMTP receipt variables and Cloudflare Turnstile keys from `.env.example`.

Then start the app with the production template:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Open `http://localhost:3000/admin/login`. The production Compose template uses `DATABASE_URL=file:/app/data/prod.db` and persists that database in the `lottery-data` volume.

For production setup, backups, reverse proxy notes, upgrades, and troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md). For campaign operating checklists, see [RUNBOOK.md](RUNBOOK.md).

## Production Self-Hosting Checklist

- Generate a long random `AUTH_SECRET`; never reuse the example value.
- Generate `ADMIN_PASSWORD_HASH` with `npm run hash-password -- "your-password"`.
- Use Docker Compose or another persistent volume for SQLite, and back up the database before draws and before upgrades.
- Put the app behind HTTPS and a trusted reverse proxy. Set `TRUST_PROXY_HEADERS=true` only when your proxy controls forwarded IP headers.
- Set a real `ADMIN_EMAIL`, configure support details in `/admin/settings`, and replace demo rules before publishing campaigns.
- Verify runtime health with `/api/health` after deployment.
- Configure SMTP only if you want ticket receipt emails; entries remain valid when email is not configured.
- Configure Turnstile only if you want a public-entry challenge; keep rate limits and honeypots enabled either way.
- Confirm legal, tax, age, prize, advertising, and licensing requirements before accepting public entries.
- Keep dependencies updated and review `SECURITY.md` before reporting vulnerabilities.
- Review [RUNBOOK.md](RUNBOOK.md) before launch, before draws, after draws, and during backup/restore drills.

## CSV Import Format

Use a header row with these columns:

```csv
name,email,reference
Jordan Lee,jordan.lee@example.com,INV-1001
Taylor Morgan,taylor.morgan@example.com,INV-1002
```

`reference` is optional, but each email and reference must be unique within a campaign.

## Public Entries

Admins can enable public entries per campaign. Public entry forms appear only when a campaign is published, open, inside its configured date window, and has no completed draw. After a participant enters, the app shows a ticket code for their records.

Participants can revisit `/campaigns/[slug]/lookup` to find their ticket code with the email address used for entry. Campaign admins can require the entry reference for public entry and lookup when stronger participant verification is preferred.

Public entry, ticket lookup, and admin login forms include basic abuse protection with SQLite-backed rate limits. Public forms also include hidden honeypot fields. By default, the app does not trust forwarded IP headers; set `TRUST_PROXY_HEADERS=true` only behind a controlled proxy, WAF, or platform that strips client-supplied forwarding headers.

Operators can optionally configure Cloudflare Turnstile with `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Public entries from disposable email domains are flagged for admin review. Flagged or rejected entries are excluded from draws until an admin approves them.

Operators can optionally configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and related credentials. Ticket receipts are best-effort: delivery failures are logged for admins but do not reject a participant entry.

## CSV Export

Campaign admins can download CSV records from the campaign management page:

- entries: all tickets and participant details.
- winners: completed draw winners, prize names, seed hash, and algorithm version.
- audit log: campaign, entry, prize, import, and draw activity tied to the campaign.

The admin dashboard also provides global CSV exports for entries, winners, and audit records across all campaigns. Use the dashboard export filters to narrow downloads by campaign, campaign status, and date range before downloading. The dashboard shows matching result counts beside each global export link.

## Campaign Lifecycle

Archive old campaigns to remove them from public and active admin lists while preserving entries, winners, exports, and audit history. Archived campaigns can be restored from the admin dashboard or campaign management page.

Delete is only available for draft campaigns with no completed draw. The admin must type the campaign title exactly before deletion.

## Draw Record

Completed public campaigns include a draw record page at `/campaigns/[slug]/verify`. It shows the revealed seed, seed hash, frozen entry manifest hash, verification bundle hash, algorithm version, draw timestamp, entry counts, winner count, and ordered winners for participant inspection.

Download `/campaigns/[slug]/verify/bundle.json` and replay it locally:

```bash
npm run verify:draw -- bundle.json
```

Legacy draws created before verification bundles remain visible but cannot be replayed from a frozen manifest. Draw verification does not replace legal, regulatory, or independent audit requirements.

## Branding Settings

Admins can customize the operator identity at `/admin/settings`. Configure the public operator name, tagline, support email, hosted logo URL, and primary brand color. Existing deployments should run `npm run db:push` after pulling this version so the settings table exists.

## Legal And Compliance Notice

Do not use this app to operate a real-money lottery, gambling product, paid raffle, or regulated promotion unless you have confirmed that your use is lawful. This app does not provide KYC, geolocation, payment processing, tax reporting, responsible gaming controls, or regulatory certification.

## Repository Status

This repository is public and free to use under the MIT License. It is provided as self-hosted software for operators and developers; it is not a managed service and does not include regulatory certification.

For maintainer release steps, see [docs/RELEASING.md](docs/RELEASING.md).

## Scripts

- `npm run dev`: start the local development server.
- `npm run build`: generate Prisma Client and build the app.
- `npm run lint`: run ESLint checks.
- `npm test`: run automated tests.
- `npm run db:push`: apply the Prisma schema to the configured SQLite database.
- `npm run db:seed`: load the demo campaign.
- `npm run backup`: copy the production SQLite database from Docker storage into `backups/`.
- `npm run restore -- backups/prod-YYYYMMDD-HHMMSS.db --confirm`: restore a production SQLite backup.
- `npm run hash-password -- "password"`: generate an admin password hash.
- `npm run smoke:deploy -- http://localhost:3000`: verify a deployed app and database health check.
- `npm run smoke:e2e -- http://localhost:3000`: verify core public, admin login, health, and optional demo campaign pages on a running app.
- `npm run screenshots`: capture README screenshots from a running local app.
- `npm run verify:draw -- bundle.json`: replay a public draw verification bundle.
