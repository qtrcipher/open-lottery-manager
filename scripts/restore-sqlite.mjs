#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const composeFile = "docker-compose.prod.yml";
const serviceName = "app";
const databasePath = "/app/data/prod.db";
const backupDir = path.resolve("backups");
const args = process.argv.slice(2);
const backupArg = args.find((arg) => !arg.startsWith("--"));
const confirmed = args.includes("--confirm");

function fail(message) {
  console.error(`Restore failed: ${message}`);
  process.exit(1);
}

function usage() {
  return "Usage: npm run restore -- backups/prod-YYYYMMDD-HHMMSS.db --confirm";
}

function runDocker(args, { stdio = "pipe" } = {}) {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      stdio
    });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || error.message);
  }
}

function runCompose(args, options) {
  return runDocker(["compose", "-f", composeFile, ...args], options);
}

function appContainerId() {
  return runCompose(["ps", "-q", serviceName]).trim();
}

function isContainerRunning(containerId) {
  if (!containerId) {
    return false;
  }

  return runDocker(["inspect", "--format={{.State.Running}}", containerId]).trim() === "true";
}

function resolveBackupPath(value) {
  if (!value) {
    fail(`backup path is required. ${usage()}`);
  }

  const resolvedPath = path.resolve(value);
  const relativePath = path.relative(backupDir, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    fail("backup path must be inside the local backups/ directory.");
  }

  if (path.dirname(resolvedPath) !== backupDir) {
    fail("backup path must be a direct file inside backups/.");
  }

  const fileName = path.basename(resolvedPath);
  if (!/^prod-\d{8}-\d{6}\.db$/.test(fileName)) {
    fail("backup file name must match prod-YYYYMMDD-HHMMSS.db.");
  }

  return { fileName, resolvedPath };
}

if (!confirmed) {
  fail(`restore is destructive; rerun with --confirm. ${usage()}`);
}

const { fileName: backupFileName, resolvedPath: backupPath } = resolveBackupPath(backupArg);

if (!fs.existsSync(backupPath)) {
  fail(`backup file does not exist: ${backupPath}`);
}

const backupStats = fs.statSync(backupPath);
if (!backupStats.isFile()) {
  fail(`backup path is not a file: ${backupPath}`);
}

if (backupStats.size <= 0) {
  fail(`backup file is empty: ${backupPath}`);
}

try {
  runDocker(["compose", "version"]);
} catch {
  fail("Docker Compose is not available. Install Docker Desktop or Docker Compose v2.");
}

let stoppedByScript = false;
let restoreError;

try {
  const containerId = appContainerId();
  const wasRunning = isContainerRunning(containerId);

  if (wasRunning) {
    console.log("Stopping production app before restoring SQLite database...");
    runCompose(["stop", serviceName], { stdio: "inherit" });
    stoppedByScript = true;
  }

  console.log(`Restoring backup: ${backupPath}`);
  runCompose(
    [
      "run",
      "--rm",
      "--no-deps",
      "--user",
      "root",
      "--entrypoint",
      "sh",
      "-v",
      `${backupDir}:/backup:ro`,
      serviceName,
      "-c",
      [
        `if [ ! -s /backup/${backupFileName} ]; then echo "Backup /backup/${backupFileName} is missing or empty." >&2; exit 1; fi`,
        `cp /backup/${backupFileName} ${databasePath}`,
        `chown nextjs:nodejs ${databasePath}`,
        `chmod 600 ${databasePath}`,
        `test -s ${databasePath}`
      ].join(" && ")
    ],
    { stdio: "inherit" }
  );

  console.log(`Restored ${databasePath} from ${backupPath}`);
  console.log(`Size: ${backupStats.size} bytes`);
} catch (error) {
  restoreError = error;
} finally {
  if (stoppedByScript) {
    try {
      console.log("Restarting production app...");
      runCompose(["up", "-d", serviceName], { stdio: "inherit" });
    } catch (error) {
      console.error(`Restore restart failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

if (restoreError) {
  fail(restoreError.message);
}
