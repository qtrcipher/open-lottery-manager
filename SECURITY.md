# Security Policy

## Supported Versions

Security fixes are handled on the `main` branch. This project does not currently publish versioned long-term support releases.

## Reporting A Vulnerability

Do not open a public GitHub issue for vulnerabilities, secrets, or exploit details. Instead, contact the maintainers privately through the repository owner's GitHub profile and include:

- a clear description of the issue,
- steps to reproduce it,
- affected routes, commands, or configuration,
- the practical impact, and
- any safe proof-of-concept details.

Avoid sending live secrets, real participant data, raw production databases, or private keys. If you need to share sensitive evidence, first ask for a secure transfer method.

## Security Boundaries

Open Lottery Manager is self-hosted software. Operators are responsible for deployment hardening, HTTPS, backups, access control, legal compliance, and monitoring. The app does not provide KYC, geolocation, payment processing, responsible gaming controls, tax reporting, or regulatory certification.

Admin login, public entry, and ticket lookup forms include SQLite-backed rate-limit controls. Public entry and lookup forms also include basic honeypot controls. By default, the app ignores forwarded IP headers; set `TRUST_PROXY_HEADERS=true` only behind a trusted reverse proxy or WAF that controls `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.

Campaign admins can require an entry reference for public entry and ticket lookup when email-only lookup is not strong enough for the campaign.
