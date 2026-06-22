# Changelog

All notable changes to Open Lottery Manager will be documented in this file.

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
