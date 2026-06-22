#!/usr/bin/env node

const defaultBaseUrl = "http://localhost:3000";
const baseUrlInput = process.argv[2] ?? defaultBaseUrl;
const timeoutMs = 10000;

function fail(message) {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value);
  } catch {
    fail(`invalid base URL "${value}". Usage: npm run smoke:deploy -- http://localhost:3000`);
  }
}

const baseUrl = normalizeBaseUrl(baseUrlInput);
const healthUrl = new URL("/api/health", baseUrl);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

let response;

try {
  response = await fetch(healthUrl, {
    headers: {
      Accept: "application/json"
    },
    signal: controller.signal
  });
} catch (error) {
  if (error?.name === "AbortError") {
    fail(`request to ${healthUrl} timed out after ${timeoutMs}ms.`);
  }
  fail(`could not reach ${healthUrl}.`);
} finally {
  clearTimeout(timeout);
}

let payload;

try {
  payload = await response.json();
} catch {
  fail(`expected JSON from ${healthUrl}, received HTTP ${response.status}.`);
}

if (response.status !== 200) {
  fail(`expected HTTP 200 from ${healthUrl}, received HTTP ${response.status}.`);
}

if (payload?.status !== "ok") {
  fail(`expected health status "ok", received "${payload?.status ?? "missing"}".`);
}

if (payload?.database?.status !== "ok") {
  fail(`expected database status "ok", received "${payload?.database?.status ?? "missing"}".`);
}

console.log(`Smoke test passed: ${healthUrl}`);
console.log(`Version: ${payload.version ?? "unknown"}`);
console.log(`Timestamp: ${payload.timestamp ?? "unknown"}`);
