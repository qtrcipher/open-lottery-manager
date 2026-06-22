# Open Lottery Manager

Open Lottery Manager is a self-hosted web app for lawful prize campaigns, raffles, promotional draws, and licensed lottery-style operations. It gives operators a simple admin dashboard, public campaign pages, auditable winner selection, and export-friendly results.

This project is software only. Operators are responsible for complying with all applicable licensing, age, tax, prize, advertising, consumer protection, and gambling laws in the places where they use it.

## Features

- Campaign setup with public rules, dates, and status.
- Fixed prize lists with one or more winners.
- Manual entry creation and CSV import.
- Auditable draws using server-side cryptographic randomness.
- Public results pages with seed hashes and algorithm version.
- Single-admin authentication for small self-hosted deployments.
- SQLite persistence through Prisma.

## Quick Start

```bash
npm install
cp .env.example .env
npm run hash-password -- "change-me"
npm run db:push
npm run dev
```

Update `.env` with the generated `ADMIN_PASSWORD_HASH`, a strong `AUTH_SECRET`, and your admin email. Then visit `http://localhost:3000/admin/login`.

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

Then start the app:

```bash
docker compose up --build
```

Open `http://localhost:3000/admin/login`. The Compose service uses `DATABASE_URL=file:/app/data/prod.db` and persists that database in the `lottery-data` volume.

## CSV Import Format

Use a header row with these columns:

```csv
name,email,reference
Fatima Noor,fatima@example.com,INV-1001
Omar Ali,omar@example.com,INV-1002
```

`reference` is optional, but each email and reference must be unique within a campaign.

## Legal And Compliance Notice

Do not use this app to operate a real-money lottery, gambling product, paid raffle, or regulated promotion unless you have confirmed that your use is lawful. This app does not provide KYC, geolocation, payment processing, tax reporting, responsible gaming controls, or regulatory certification.

## Scripts

- `npm run dev`: start the local development server.
- `npm run build`: generate Prisma Client and build the app.
- `npm run lint`: run Next.js lint checks.
- `npm test`: run automated tests.
- `npm run db:push`: apply the Prisma schema to the configured SQLite database.
- `npm run hash-password -- "password"`: generate an admin password hash.
