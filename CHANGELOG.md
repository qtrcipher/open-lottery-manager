# Changelog

All notable changes to Open Lottery Manager will be documented in this file.

## v0.1.18 - 2026-06-23

Main CI E2E smoke check.

### Added

- CI workflow now runs the Playwright E2E smoke check for pushes to main.

### Changed

- Main-branch CI now seeds demo data, starts the built app, and requires demo campaign, ticket lookup, and draw record pages to render.

### Operations

- Pull requests keep faster checks while main pushes gain page-rendering validation before release prep.

## v0.1.17 - 2026-06-23

Release validation E2E smoke.

### Added

- Release Tag Validation workflow now runs the Playwright E2E smoke check against a started app.

### Changed

- Release validation now seeds demo data and requires demo campaign, ticket lookup, and draw record pages to render.

### Operations

- Published release tags now verify app startup, SQLite schema setup, seeded demo data, health, and core page rendering before passing validation.

## v0.1.16 - 2026-06-23

E2E smoke QA script.

### Added

- Playwright-based E2E smoke script for health, public home, admin login, and demo campaign pages.

### Changed

- README, deployment guide, and operator runbook now document `npm run smoke:e2e -- http://localhost:3000`.

### Operations

- Operators can run optional `--require-demo` checks after seeding demo data to validate campaign, lookup, and draw record pages.

## v0.1.15 - 2026-06-23

Admin Operations documentation links.

### Added

- Admin Operations panel links for deployment docs, operator runbook, release guide, and security-header guidance.

### Changed

- Admin Operations panel now groups documentation links and clarifies that dashboard links do not execute maintenance tasks.

### Operations

- Operators can reach deployment, backup, runbook, release, and security-header references from the admin dashboard.

## v0.1.14 - 2026-06-23

Baseline HTTP security headers.

### Added

- App-wide baseline browser security headers, including Content Security Policy, frame blocking, content-type sniffing protection, referrer policy, permissions policy, DNS prefetch control, and production HSTS.

### Changed

- Deployment guide now documents reverse proxy handling for app-emitted security headers.

### Operations

- Operators can preserve or intentionally replace the app security headers at the reverse proxy and retest core admin and public flows after policy changes.

## v0.1.13 - 2026-06-23

Release process documentation.

### Added

- Release guide documenting version prep, changelog updates, verification, tagging, GitHub release creation, and workflow validation.

### Changed

- README now links maintainers to the release guide.

### Operations

- Maintainers can follow one documented checklist for publishing and validating releases.

## v0.1.12 - 2026-06-23

Operator runbook documentation.

### Added

- Operator runbook with launch, live-campaign, pre-draw, post-draw, backup drill, and incident checklists.

### Changed

- README and deployment guide now link to the operator runbook from production operations sections.

### Operations

- Operators can follow a single checklist for campaign operations and backup/restore drills.

## v0.1.11 - 2026-06-23

Admin dashboard metrics overview.

### Added

- Admin dashboard metrics row for total campaigns, active campaigns, entries, winners, and audit events.

### Changed

- Admin dashboard now surfaces global operational totals before status and operations panels.

### Operations

- Operators can quickly scan campaign and record volume from the dashboard.

## v0.1.10 - 2026-06-23

Admin activity, export count, and operations documentation improvements.

### Added

- Admin dashboard Recent activity panel for the latest audit log events with campaign context links when available.
- Matching result counts for global entries, winners, and audit CSV exports.

### Changed

- Global export UI now shows how many entries, winners, and audit records match the selected filters before download.

### Operations

- README and deployment documentation now explain dashboard-level global exports, filters, and backup readiness behavior.

## v0.1.9 - 2026-06-22

Export filtering, backup readiness, and version visibility improvements.

### Added

- Global CSV export filters for campaign, campaign status, and date range.
- Admin dashboard Backup readiness panel with host-side backup expectations and documentation link.
- Public release version badge backed by package metadata.

### Changed

- Global export links now preserve selected campaign, status, and date filters.

### Operations

- Operators can filter admin-wide exports, confirm backup expectations, and identify the running release.

## v0.1.8 - 2026-06-22

Admin operations, system status, and global export improvements.

### Added

- Deployment troubleshooting guide for environment, database, Docker healthcheck, smoke-test, backup, restore, and proxy header issues.
- Admin dashboard System status panel with app version, database status, uptime, and configured public URL.
- Admin dashboard global CSV exports for all entries, winners, and audit records.

### Changed

- `/api/health` now includes uptime and configured public URL while preserving existing status and database fields.

### Operations

- Operators can inspect deployment status and download all entries, winners, and audit records from the admin dashboard.

## v0.1.7 - 2026-06-22

Admin operations documentation panel.

### Added

- Admin dashboard Operations panel with backup, restore, and deployment smoke-test command references.
- Deployment guide link from the admin dashboard.

### Changed

- Admin dashboard now surfaces host-side maintenance documentation without adding browser-triggered maintenance actions.

### Operations

- Admins can find backup, restore, and smoke-test commands from the dashboard context.

## v0.1.6 - 2026-06-22

Admin audit log filtering.

### Added

- Campaign admin audit log panel with search, action filters, entity filters, date range filters, and pagination.
- Audit log query helper and unit tests for filter parsing and pagination behavior.

### Changed

- Audit log lookups now include Prisma indexes for entity, action, and created-at queries.

### Operations

- Admins can inspect campaign activity in the dashboard without exporting the full audit CSV.

## v0.1.5 - 2026-06-22

Database backup and restore helpers.

### Added

- Production SQLite backup helper with `npm run backup`.
- Guarded production SQLite restore helper with `npm run restore -- backups/prod-YYYYMMDD-HHMMSS.db --confirm`.

### Changed

- README and deployment guide now document helper-based backup and restore commands.

### Operations

- Backup and restore helpers stop running app containers, operate on `/app/data/prod.db`, and restart the app when needed.

## v0.1.4 - 2026-06-22

Production deployment templates and smoke checks.

### Added

- Production Docker Compose template in `docker-compose.prod.yml`.
- Deployment smoke test command with `npm run smoke:deploy -- http://localhost:3000`.

### Changed

- README and deployment guide now point production users to the production Compose template and smoke test.

### Operations

- Self-hosters can validate `/api/health`, app status, and database status with one command after deployment.

## v0.1.3 - 2026-06-22

Docker healthcheck support.

### Added

- Docker Compose container healthcheck using `/api/health`.

### Operations

- Deployment documentation for checking container health with `docker compose ps`.

## v0.1.2 - 2026-06-22

Operations and release automation improvements.

### Added

- Runtime health endpoint at `/api/health` with app status, package version, timestamp, and database connectivity.
- Release preparation script, release process documentation, and release tag validation workflow.

### Changed

- Release workflow now validates version metadata, changelog notes, tests, linting, build output, Docker builds, and dependency audit on pushed release tags.

### Operations

- Deployment guide with Docker Compose setup, SQLite backup and restore commands, reverse proxy guidance, upgrade checks, and runtime health verification.

## v0.1.1 - 2026-06-22

Public release polish and operator workflow improvements after the initial `v0.1.0` release.

### Added

- Public participant entry forms with ticket confirmation and basic abuse protection.
- Participant ticket lookup for public campaign pages.
- Public draw verification pages and polished campaign result views.
- Admin participant management, prize management, and improved CSV import error handling.
- Campaign lifecycle controls, operator branding settings, and draw integrity safeguards.
- Contributor, security, issue template, pull request template, and public release documentation.

### Operations

- Use Docker Compose or another persistent volume for SQLite production data.
- Back up the database before draws and upgrades.
- Put internet-facing deployments behind HTTPS and a trusted reverse proxy.
- Confirm legal, tax, age, prize, advertising, and licensing requirements before accepting public entries.

## v0.1.0 - 2026-06-22

Initial public release for self-hosted lottery and prize draw management.

### Added

- Public campaign pages with visible campaign status, prize details, and published results.
- Admin campaign management for creating campaigns, adding prizes, entering participants, and running draws.
- Manual entry creation and CSV import for participant records.
- Deterministic draw logic with stored seeds, winner records, and audit logs.
- Single-admin authentication configured through environment variables.
- SQLite persistence through Prisma, with local and Docker-based setup paths.
- Demo seed data and screenshot capture scripts for evaluating the app quickly.
- GitHub Actions CI for tests, linting, production build, Docker image build, and dependency audit.

### Operations

- Run locally with `npm run dev` after configuring `.env` and applying the Prisma schema.
- Seed sample data with `npm run db:seed`.
- Run with Docker Compose using `docker compose up --build`.

### Legal Notice

This project is released as open-source software for operators to self-host. Lottery,
raffle, sweepstakes, and prize promotion laws vary by jurisdiction. Operators are
responsible for confirming legal requirements, disclosures, eligibility rules, and
recordkeeping obligations before using this app for a real campaign.
