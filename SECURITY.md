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

Public entry and lookup forms include basic honeypot and rate-limit controls. For internet-facing deployments, run the app behind a trusted reverse proxy or WAF and control forwarded IP headers.
