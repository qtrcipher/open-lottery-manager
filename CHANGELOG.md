# Changelog

All notable changes to Open Lottery Manager will be documented in this file.

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
