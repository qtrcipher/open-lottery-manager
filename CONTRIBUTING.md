# Contributing

Thanks for helping improve Open Lottery Manager. Keep changes focused, verifiable, and aligned with lawful self-hosted campaign management.

## Local Setup

```bash
npm install
cp .env.example .env
npm run hash-password -- "change-me"
npm run db:push
npm run dev
```

Use `npm run db:seed` when you need demo campaigns, entries, prizes, and draw records.

## Development Guidelines

- Keep business rules in `src/lib` or server actions, not embedded in JSX.
- Add deterministic Vitest coverage for draw logic, validation, CSV parsing, tickets, auth, rate limits, and lifecycle changes.
- For visible UI changes, run the app locally, run `npm run screenshots`, and inspect the updated files in `docs/screenshots/`.
- Do not add payments, wallets, KYC, geolocation, or regulated-money flows without a clear legal target and security review.
- Do not commit `.env`, SQLite databases, build output, logs, or secrets.

## Commit And Pull Request Expectations

Use short imperative commit subjects, such as `Add participant ticket lookup`. Pull requests should include:

- a concise summary,
- verification commands,
- screenshots for visible UI changes,
- security and compliance impact, and
- linked issues when relevant.

Before opening a pull request, run:

```bash
npm test
npm run lint
npm run build
git diff --check
```
