# Release Process

Use this checklist to publish a new Open Lottery Manager release. Release publishing stays manual; GitHub Actions validates pushed release tags but does not create GitHub Releases.

## Prepare Release Files

Start from a clean `main` branch:

```bash
git checkout main
git pull origin main
git status --short
```

Prepare the next version:

```bash
npm run release:prepare -- 0.1.2 "Short release summary"
```

For inspection without writing files:

```bash
npm run release:prepare:dry-run -- 0.1.2 "Short release summary"
```

The prepare script updates `package.json`, `package-lock.json`, and inserts a new top section in `CHANGELOG.md`. Replace every `TODO_RELEASE_NOTES` line with real release notes before committing.

## Verify And Commit

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Then commit:

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "Prepare v0.1.2 release"
git push origin main
```

## Tag

Create and push an annotated tag:

```bash
git tag -a v0.1.2 -m "Open Lottery Manager v0.1.2"
git push origin v0.1.2
```

The `Release Tag Validation` workflow runs on pushed `v*.*.*` tags. It verifies the tag format, package version, changelog header, absence of `TODO_RELEASE_NOTES`, tests, lint, build, Docker build, and dependency audit.

## Publish GitHub Release

Create release notes from `CHANGELOG.md`. Include:

- a short summary,
- notable changes,
- quick start commands,
- Docker Compose note,
- verification summary, and
- legal/compliance notice.

Publish manually with GitHub CLI:

```bash
gh release create v0.1.2 \
  --repo qtrcipher/open-lottery-manager \
  --title "v0.1.2" \
  --notes-file release-notes.md \
  --latest
```

Verify:

```bash
gh release view v0.1.2 --repo qtrcipher/open-lottery-manager
git ls-remote --tags origin "v0.1.2*"
```
