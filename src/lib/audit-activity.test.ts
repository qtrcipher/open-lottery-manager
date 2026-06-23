import { describe, expect, it } from "vitest";
import { campaignIdForActivityLog, recentActivityItems } from "./audit-activity";

const campaign = {
  id: "campaign_1",
  title: "Summer Draw",
  slug: "summer-draw",
  status: "OPEN"
};

describe("campaignIdForActivityLog", () => {
  it("reads campaign context from campaign entity records", () => {
    expect(
      campaignIdForActivityLog(
        {
          action: "campaign.update",
          entityType: "Campaign",
          entityId: "campaign_1",
          metadata: null,
          createdAt: new Date()
        },
        new Set(["campaign_1"])
      )
    ).toBe("campaign_1");
  });

  it("reads campaign context from metadata", () => {
    expect(
      campaignIdForActivityLog(
        {
          action: "entry.create",
          entityType: "Entry",
          entityId: "entry_1",
          metadata: JSON.stringify({ campaignId: "campaign_1" }),
          createdAt: new Date()
        },
        new Set(["campaign_1"])
      )
    ).toBe("campaign_1");
  });

  it("ignores malformed or unknown campaign metadata", () => {
    expect(
      campaignIdForActivityLog(
        {
          action: "settings.update",
          entityType: "AppSettings",
          entityId: "app",
          metadata: "{bad-json",
          createdAt: new Date()
        },
        new Set(["campaign_1"])
      )
    ).toBeNull();
  });
});

describe("recentActivityItems", () => {
  it("attaches campaign details when inferable", () => {
    const createdAt = new Date("2026-06-22T10:00:00.000Z");

    expect(
      recentActivityItems(
        [
          {
            action: "entry.create",
            entityType: "Entry",
            entityId: "entry_1",
            metadata: JSON.stringify({ campaignId: "campaign_1" }),
            createdAt
          }
        ],
        [campaign]
      )
    ).toEqual([
      {
        action: "entry.create",
        entityType: "Entry",
        entityId: "entry_1",
        metadata: JSON.stringify({ campaignId: "campaign_1" }),
        createdAt,
        campaign
      }
    ]);
  });
});
