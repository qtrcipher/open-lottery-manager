import { describe, expect, it } from "vitest";
import { auditExportCount } from "./export-counts";
import { parseGlobalExportFilters } from "./export-filters";

const campaigns = [
  {
    id: "campaign_1",
    title: "Summer Draw",
    slug: "summer-draw",
    status: "OPEN"
  },
  {
    id: "campaign_2",
    title: "Winter Draw",
    slug: "winter-draw",
    status: "DRAWN"
  }
];

const logs = [
  {
    action: "campaign.create",
    entityType: "Campaign",
    entityId: "campaign_1",
    metadata: null,
    createdAt: new Date("2026-06-22T09:00:00.000Z")
  },
  {
    action: "draw.run",
    entityType: "Draw",
    entityId: "draw_1",
    metadata: JSON.stringify({ campaignId: "campaign_2" }),
    createdAt: new Date("2026-06-22T10:00:00.000Z")
  },
  {
    action: "settings.update",
    entityType: "AppSettings",
    entityId: "app",
    metadata: null,
    createdAt: new Date("2026-06-22T11:00:00.000Z")
  }
];

describe("auditExportCount", () => {
  it("counts all loaded logs when no campaign context filter is active", () => {
    expect(auditExportCount(logs, campaigns, parseGlobalExportFilters({}))).toBe(3);
  });

  it("counts only logs matching selected campaign context", () => {
    expect(auditExportCount(logs, campaigns, parseGlobalExportFilters({ campaignId: "campaign_1" }))).toBe(1);
  });

  it("counts only logs matching selected campaign status context", () => {
    expect(auditExportCount(logs, campaigns, parseGlobalExportFilters({ status: "DRAWN" }))).toBe(1);
  });
});
