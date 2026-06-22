# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router app for self-hosted prize campaigns and licensed lottery-style operations. Routes live in `src/app`: public campaign pages under `src/app/campaigns`, admin screens under `src/app/admin`, and server actions beside their routes. Shared UI belongs in `src/components`; draw logic, validators, auth, CSV parsing, tickets, rate limiting, and Prisma helpers belong in `src/lib`. Database schema is `prisma/schema.prisma`; scripts are in `scripts/`; screenshots are in `docs/screenshots/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `cp .env.example .env`: create local configuration.
- `npm run hash-password -- "password"`: generate `ADMIN_PASSWORD_HASH`.
- `npm run db:push`: apply the Prisma schema to SQLite.
- `npm run db:seed`: load the demo campaign and admin-friendly sample data.
- `npm run dev`: start the local app at `http://localhost:3000`.
- `npm test`: run Vitest unit tests.
- `npm run lint`: run ESLint.
- `npm run build`: generate Prisma Client and build Next.js.
- `npm run screenshots`: refresh README screenshots from a running local app.

## Coding Style & Naming Conventions

Use strict TypeScript and keep durable business rules in `src/lib` or server actions, not inside JSX. Exported React components use `PascalCase`; functions, variables, and Prisma fields use `camelCase`; URL segments use kebab-case. Prefer server-rendered public pages, accessible labels, visible focus states, and lucide icons where they improve scanning.

## Testing Guidelines

Use Vitest for focused unit tests under `src/**/*.test.ts`. Cover draw selection, seed/hash behavior, tickets, campaign lifecycle, CSV import validation, auth helpers, rate limits, and edge cases before UI polish. Tests must be deterministic; use fixed seeds for draw tests. For visible UI changes, run `npm run screenshots` against a local app and inspect updated images.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, for example `Add participant ticket lookup` and `Polish public campaign pages`. Keep each commit scoped to one task. Pull requests should include a concise summary, verification commands, screenshots for visible UI changes, and compliance assumptions. Do not commit `.env`, SQLite databases, generated build output, or secrets.

## Security & Compliance Tips

This project distributes software only. Operators remain responsible for lottery, gambling, promotion, tax, age, prize, advertising, and licensing compliance. Do not add payments, wallets, KYC, geolocation, or regulated-money flows without a clear legal target and separate security review. Public entry and lookup forms already use honeypots and SQLite-backed rate limits; preserve those controls when changing participant flows.
