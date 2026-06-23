# Operator Runbook

This runbook is operational guidance for self-hosted Open Lottery Manager deployments. It is not legal, tax, licensing, gambling, advertising, or regulatory advice. Confirm requirements for every campaign before accepting public entries.

## Before Launch

- Confirm legal, tax, age, prize, advertising, privacy, and licensing requirements for the campaign.
- Deploy from a tagged release, configure `.env`, and keep `AUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` private.
- Put the app behind HTTPS and a trusted reverse proxy. Only trusted infrastructure should set forwarded IP headers.
- Configure `/admin/settings` with the public operator name, tagline, support email, logo, and brand color.
- Replace demo rules with operator-approved campaign rules, eligibility terms, dates, and prize descriptions.
- Run a test campaign, public entry, ticket lookup, draw, export, backup, restore drill, `npm run smoke:deploy -- http://localhost:3000`, and `npm run smoke:e2e -- http://localhost:3000`.

## During Campaign

- Monitor the admin dashboard metrics row for campaign, entry, winner, and audit volume.
- Confirm public campaign pages, entry forms, and ticket lookup remain reachable.
- Review recent activity and campaign audit logs for unexpected imports, edits, deletes, or draw activity.
- Export entries periodically when operational recordkeeping requires it.
- Run backups on the host server at the cadence required by the campaign risk profile.

## Before Running A Draw

- Confirm the public entry window is closed or intentionally locked.
- Export entries and review eligibility before running the draw.
- Confirm prizes, quantities, rules, and campaign status are correct.
- Run `npm run backup` on the host server and retain the backup outside the app container.
- Record any required operational approvals outside the app before pressing the draw button.

## After Draw

- Check the public results page and `/campaigns/[slug]/verify` page.
- Export winners and audit logs for operator records.
- Confirm the seed hash, algorithm version, draw timestamp, entry count, and winner order are visible where expected.
- Preserve backups and exports according to the operator recordkeeping policy.
- Archive campaigns when they no longer need to appear in active admin and public lists.

## Backup And Restore Drill

- Run `npm run backup` from the host repository directory.
- Confirm a non-empty `backups/prod-YYYYMMDD-HHMMSS.db` file exists.
- Test restore steps on a copy or non-production environment with `npm run restore -- backups/prod-YYYYMMDD-HHMMSS.db --confirm`.
- Start the app and run `npm run smoke:deploy -- http://localhost:3000` and `npm run smoke:e2e -- http://localhost:3000`.
- Confirm admin login, campaign lists, public pages, recent audit logs, and completed draw records still load.

## Incident Checklist

- Admin login issue: confirm `ADMIN_EMAIL`, regenerate `ADMIN_PASSWORD_HASH`, and check app logs.
- Unhealthy app: run `docker compose -f docker-compose.prod.yml ps`, inspect logs, and call `/api/health`.
- Failed smoke test: verify the URL reaches this app and the database status is `ok`.
- Bad rate limits or client identity: verify only the trusted proxy can set `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.
- Suspected data issue: stop public changes, take a backup, export audit logs, preserve logs, and restore only after testing on a copy.
