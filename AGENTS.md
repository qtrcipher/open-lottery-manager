# Repository Guidelines

## Project Structure & Module Organization

This repository is a Next.js App Router project for a self-hosted lottery campaign manager. Application routes live in `src/app`, shared UI components in `src/components`, and business logic in `src/lib`. Prisma schema and SQLite configuration live in `prisma/schema.prisma`. Utility scripts belong in `scripts/`, and public project documentation starts in `README.md`.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `cp .env.example .env`: create local configuration.
- `npm run hash-password -- "password"`: generate `ADMIN_PASSWORD_HASH`.
- `npm run db:push`: apply the Prisma schema to SQLite.
- `npm run dev`: start the local app at `http://localhost:3000`.
- `npm test`: run Vitest unit tests.
- `npm run lint`: run ESLint.
- `npm run build`: generate Prisma Client and build Next.js.

## Coding Style & Naming Conventions

Use strict TypeScript and keep server-side business logic in `src/lib` or server actions. Components and route modules use `PascalCase` for exported React components, `camelCase` for functions and variables, and kebab-case for URL segments. Prefer accessible labels, visible focus states, and server-rendered content for public pages. Keep Tailwind classes readable and avoid introducing UI libraries unless they remove real complexity.

## Testing Guidelines

Use Vitest for focused unit tests under `src/**/*.test.ts`. Cover draw selection, seed/hash behavior, CSV parsing, auth helpers, validation, and edge cases before adding UI polish. Tests should be deterministic; use fixed seeds for lottery draw tests. Run `npm test`, `npm run lint`, and `npm run build` before committing.

## Commit & Pull Request Guidelines

Use short imperative commit subjects, for example `Add auditable draw engine`. Pull requests should include a concise summary, verification commands, screenshots for visible UI changes, and any compliance assumptions. Do not commit `.env`, SQLite databases, generated build output, or secrets.

## Security & Compliance Tips

This project distributes software only. Operators are responsible for lottery, gambling, promotion, tax, age, prize, and licensing compliance. Do not add built-in payments, wallets, KYC, or geolocation without a clear regulatory target and separate security review.
