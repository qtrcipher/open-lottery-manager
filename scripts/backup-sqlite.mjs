#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const composeFile = "docker-compose.prod.yml";
const serviceName = "app";
const databasePath = "/app/data/prod.db";
const backupDir = path.resolve("backups");
const backupFileName = `prod-${timestamp()}.db`;
const backupPath = path.join(backupDir, backupFileName);

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function fail(message) {
  console.error(`Backup failed: ${message}`);
  process.exit(1);
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

try {
  runDocker(["compose", "version"]);
} catch {
  fail("Docker Compose is not available. Install Docker Desktop or Docker Compose v2.");
}

fs.mkdirSync(backupDir, { recursive: true });

let stoppedByScript = false;
let backupError;

try {
  const containerId = appContainerId();
  const wasRunning = isContainerRunning(containerId);

  if (wasRunning) {
    console.log("Stopping production app before copying SQLite database...");
    runCompose(["stop", serviceName], { stdio: "inherit" });
    stoppedByScript = true;
  }

  console.log(`Creating backup: ${backupPath}`);
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
      `${backupDir}:/backup`,
      serviceName,
      "-c",
      [
        `if [ ! -s ${databasePath} ]; then echo "Production database ${databasePath} is missing or empty." >&2; exit 1; fi`,
        `cp ${databasePath} /backup/${backupFileName}`,
        `test -s /backup/${backupFileName}`
      ].join(" && ")
    ],
    { stdio: "inherit" }
  );

  const stats = fs.statSync(backupPath);
  if (stats.size <= 0) {
    throw new Error(`backup file is empty: ${backupPath}`);
  }

  console.log(`Backup created: ${backupPath}`);
  console.log(`Size: ${stats.size} bytes`);
} catch (error) {
  backupError = error;
} finally {
  if (stoppedByScript) {
    try {
      console.log("Restarting production app...");
      runCompose(["up", "-d", serviceName], { stdio: "inherit" });
    } catch (error) {
      console.error(`Backup restart failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

if (backupError) {
  fail(backupError.message);
}
