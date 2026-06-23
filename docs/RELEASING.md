# Release Guide

Use this checklist to prepare and publish Open Lottery Manager releases. Releases are tagged from `main` and validated by the `Release Tag Validation` GitHub Actions workflow.

## Before Preparing

Start from a clean local branch that matches GitHub:

```bash
git checkout main
git pull --ff-only origin main
git status --short --branch
```

Confirm the next semantic version and short summary. Pass the version without a leading `v`:

```bash
npm run release:prepare -- 0.1.X "Short release summary"
```

The script updates `package.json`, `package-lock.json`, and inserts a new `CHANGELOG.md` section.

## Edit Release Notes

Replace every `TODO_RELEASE_NOTES` entry in `CHANGELOG.md` before committing. Keep the sections concise:

- `Added`: new user, admin, operator, or developer-facing capabilities.
- `Changed`: behavior, documentation, deployment, or workflow changes.
- `Operations`: upgrade, hosting, backup, restore, monitoring, or compliance notes.

Check that the generated date and version are correct:

```bash
rg -n "TODO_RELEASE_NOTES|v0\.1\.X|0\.1\.X" CHANGELOG.md package.json package-lock.json
```

## Verify And Commit

Run the release checks before committing:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Commit only the release metadata files:

```bash
git add CHANGELOG.md package.json package-lock.json
git commit -m "Prepare v0.1.X release"
```

## Tag, Push, And Publish

Create an annotated tag and push both `main` and the tag:

```bash
git tag -a v0.1.X -m "Open Lottery Manager v0.1.X"
git push origin main
git push origin v0.1.X
```

Create a temporary `RELEASE_NOTES.md` file from the changelog entry, then publish the GitHub release:

```bash
gh release create v0.1.X \
  --repo qtrcipher/open-lottery-manager \
  --title "v0.1.X" \
  --latest \
  --notes-file RELEASE_NOTES.md
```

If release notes are short, `--notes $'...'` is also acceptable.

## Validate The Release

Confirm the tag, release, and workflow result:

```bash
git ls-remote --tags origin "v0.1.X*"
gh release view v0.1.X --repo qtrcipher/open-lottery-manager \
  --json tagName,name,isDraft,isPrerelease,publishedAt,url,targetCommitish
gh run list --repo qtrcipher/open-lottery-manager \
  --workflow "Release Tag Validation" --limit 5
gh run view RUN_ID --repo qtrcipher/open-lottery-manager \
  --json conclusion,status,displayTitle,headBranch,event,url
```

The workflow must complete with `conclusion: "success"` before announcing the release.

## If Validation Fails

If local verification fails before the release commit, fix the issue and rerun the full checks before committing.

If the tag workflow fails after pushing, inspect the failed run with `gh run view RUN_ID --log`. Fix the issue on `main`, prepare the next patch release, and publish a new tag. Do not move or rewrite published release tags.
