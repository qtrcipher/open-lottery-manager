import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.SCREENSHOT_ADMIN_PASSWORD ?? "admin123";
const outputDir = path.join(process.cwd(), "docs", "screenshots");

async function screenshot(page, name) {
  await page.screenshot({
    path: path.join(outputDir, name),
    fullPage: true
  });
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await screenshot(page, "public-home.png");

    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "networkidle" });
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "admin-dashboard.png");

    const manageHref = await page.locator('a[href^="/admin/campaigns/"]').filter({ hasText: "Manage" }).first().getAttribute("href");
    if (!manageHref) {
      throw new Error("Could not find the seeded campaign management link.");
    }
    await page.goto(new URL(manageHref, baseUrl).toString(), { waitUntil: "networkidle" });
    await page.waitForLoadState("networkidle");
    await screenshot(page, "campaign-management.png");

    await page.goto(`${baseUrl}/campaigns/demo-summer-rewards`, { waitUntil: "networkidle" });
    await screenshot(page, "public-results.png");

    console.log(`Screenshots written to ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
