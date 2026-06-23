#!/usr/bin/env node

import { chromium } from "playwright";

const defaultBaseUrl = "http://localhost:3000";
const timeoutMs = 10000;
const args = process.argv.slice(2);
const requireDemo = args.includes("--require-demo");
const positional = args.filter((arg) => arg !== "--require-demo");
const baseUrlInput = positional[0] ?? defaultBaseUrl;

function usage() {
  return "Usage: npm run smoke:e2e -- http://localhost:3000 [--require-demo]";
}

function fail(message) {
  console.error(`E2E smoke test failed: ${message}`);
  process.exit(1);
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value);
  } catch {
    fail(`invalid base URL "${value}". ${usage()}`);
  }
}

function appUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

async function checkHealth(baseUrl) {
  const healthUrl = appUrl(baseUrl, "/api/health");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
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

  console.log(`Health check passed: ${healthUrl}`);
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
}

async function checkPage(page, baseUrl, path, expectedTexts) {
  const targetUrl = appUrl(baseUrl, path);
  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const status = response?.status();

  if (status !== 200) {
    fail(`expected HTTP 200 from ${targetUrl}, received ${status ?? "no response"}.`);
  }

  for (const text of expectedTexts) {
    await expectText(page, text);
  }

  console.log(`Page check passed: ${targetUrl}`);
}

async function checkDemoPages(page, baseUrl) {
  const campaignPath = "/campaigns/demo-summer-rewards";
  const campaignUrl = appUrl(baseUrl, campaignPath);
  const response = await page.goto(campaignUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const status = response?.status();

  if (status === 404 && !requireDemo) {
    console.log(`Demo campaign not found; skipped demo checks. Use --require-demo to fail instead.`);
    return;
  }

  if (status !== 200) {
    fail(`expected HTTP 200 from ${campaignUrl}, received ${status ?? "no response"}.`);
  }

  for (const text of ["Demo Customer Rewards Draw", "Draw record", "Find my ticket", "Draw completed"]) {
    await expectText(page, text);
  }
  console.log(`Page check passed: ${campaignUrl}`);

  await checkPage(page, baseUrl, `${campaignPath}/lookup`, ["Ticket lookup", "Find my ticket", "Look up ticket"]);
  await checkPage(page, baseUrl, `${campaignPath}/verify`, ["Published draw record", "Draw summary", "Ordered winners", "Seed hash"]);
}

async function main() {
  if (positional.length > 1) {
    fail(`too many arguments. ${usage()}`);
  }

  const baseUrl = normalizeBaseUrl(baseUrlInput);
  await checkHealth(baseUrl);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await checkPage(page, baseUrl, "/", ["Open Lottery Manager", "Admin login", "Public campaigns"]);
    await checkPage(page, baseUrl, "/admin/login", ["Admin login", "Email", "Password", "Sign in"]);
    await checkDemoPages(page, baseUrl);
  } finally {
    await browser.close();
  }

  console.log(`E2E smoke test passed: ${baseUrl.toString().replace(/\/+$/, "")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
