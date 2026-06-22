#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((arg) => arg !== "--dry-run");
const [version, ...summaryParts] = positional;
const summary = summaryParts.join(" ").trim();

function usage() {
  console.error('Usage: npm run release:prepare -- 0.1.2 "Short release summary"');
  console.error('       npm run release:prepare:dry-run -- 0.1.2 "Short release summary"');
}

function fail(message) {
  console.error(`Error: ${message}`);
  usage();
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function assertCleanTree() {
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (status.trim()) {
    fail("working tree must be clean before preparing a release.");
  }
}

function releaseSection(nextVersion, releaseSummary) {
  const date = new Date().toISOString().slice(0, 10);
  return `## v${nextVersion} - ${date}

${releaseSummary}

### Added

- TODO_RELEASE_NOTES

### Changed

- TODO_RELEASE_NOTES

### Operations

- TODO_RELEASE_NOTES

`;
}

if (!version || !summary) {
  fail("version and summary are required.");
}

if (version.startsWith("v")) {
  fail("version must not include a leading v.");
}

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  fail("version must be a semantic version like 0.1.2.");
}

if (!dryRun) {
  assertCleanTree();
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
const changelogHeader = "All notable changes to Open Lottery Manager will be documented in this file.\n\n";

if (changelog.includes(`## v${version} -`)) {
  fail(`CHANGELOG.md already contains v${version}.`);
}

packageJson.version = version;
packageLock.version = version;
if (!packageLock.packages?.[""]) {
  fail('package-lock.json is missing packages[""].');
}
packageLock.packages[""].version = version;

if (!changelog.includes(changelogHeader)) {
  fail("CHANGELOG.md does not match the expected format.");
}

const nextChangelog = changelog.replace(changelogHeader, `${changelogHeader}${releaseSection(version, summary)}`);

if (dryRun) {
  console.log(`Dry run: would prepare v${version}.`);
  console.log("Would update package.json version.");
  console.log("Would update package-lock.json root versions.");
  console.log("Would insert this CHANGELOG.md section:");
  console.log("");
  console.log(releaseSection(version, summary).trimEnd());
  process.exit(0);
}

writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
fs.writeFileSync("CHANGELOG.md", nextChangelog);

console.log(`Prepared v${version}.`);
console.log("Edit CHANGELOG.md release notes before committing and tagging.");
