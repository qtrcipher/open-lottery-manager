import { describe, expect, it } from "vitest";
import { campaignIdForAuditLog, globalAuditRows, globalEntryRows, globalWinnerRows } from "./export-rows";

const campaign = {
  id: "campaign_1",
  title: "Summer Draw",
  slug: "summer-draw",
  status: "OPEN"
};

describe("globalEntryRows", () => {
  it("adds campaign context to participant rows", () => {
    expect(
      globalEntryRows([
        {
          campaign,
          ticketCode: "TICKET-1",
          name: "Jane Smith",
          email: "jane@example.com",
          reference: null,
          isEligible: true,
          createdAt: new Date("2026-06-22T10:00:00.000Z")
        }
      ])
    ).toEqual([
      {
        campaignTitle: "Summer Draw",
        campaignSlug: "summer-draw",
        campaignStatus: "OPEN",
        ticketCode: "TICKET-1",
        name: "Jane Smith",
        email: "jane@example.com",
        reference: null,
        isEligible: true,
        createdAt: new Date("2026-06-22T10:00:00.000Z")
      }
    ]);
  });
});

describe("globalWinnerRows", () => {
  it("adds campaign and draw context to winner rows", () => {
    expect(
      globalWinnerRows([
        {
          rank: 1,
          prize: { name: "Grand Prize" },
          entry: {
            ticketCode: "TICKET-1",
            name: "Jane Smith",
            email: "jane@example.com",
            reference: "INV-1"
          },
          draw: {
            seedHash: "abc123",
            algorithmVersion: "olm-random-shuffle-v1",
            createdAt: new Date("2026-06-22T11:00:00.000Z"),
            campaign
          }
        }
      ])
    ).toEqual([
      {
        campaignTitle: "Summer Draw",
        campaignSlug: "summer-draw",
        campaignStatus: "OPEN",
        rank: 1,
        prizeName: "Grand Prize",
        ticketCode: "TICKET-1",
        name: "Jane Smith",
        email: "jane@example.com",
        reference: "INV-1",
        drawSeedHash: "abc123",
        algorithmVersion: "olm-random-shuffle-v1",
        drawnAt: new Date("2026-06-22T11:00:00.000Z")
      }
    ]);
  });
});

describe("globalAuditRows", () => {
  it("infers campaign context from campaign entity ids and metadata campaign ids", () => {
    const logs = [
      {
        action: "campaign.create",
        entityType: "Campaign",
        entityId: "campaign_1",
        metadata: null,
        createdAt: new Date("2026-06-22T09:00:00.000Z")
      },
      {
        action: "entry.create",
        entityType: "Entry",
        entityId: "entry_1",
        metadata: JSON.stringify({ campaignId: "campaign_1" }),
        createdAt: new Date("2026-06-22T10:00:00.000Z")
      }
    ];

    expect(globalAuditRows(logs, [campaign])).toEqual([
      {
        campaignTitle: "Summer Draw",
        campaignSlug: "summer-draw",
        campaignStatus: "OPEN",
        action: "campaign.create",
        entityType: "Campaign",
        entityId: "campaign_1",
        metadata: null,
        createdAt: new Date("2026-06-22T09:00:00.000Z")
      },
      {
        campaignTitle: "Summer Draw",
        campaignSlug: "summer-draw",
        campaignStatus: "OPEN",
        action: "entry.create",
        entityType: "Entry",
        entityId: "entry_1",
        metadata: JSON.stringify({ campaignId: "campaign_1" }),
        createdAt: new Date("2026-06-22T10:00:00.000Z")
      }
    ]);
  });

  it("leaves campaign context empty when audit metadata does not identify a campaign", () => {
    expect(
      globalAuditRows(
        [
          {
            action: "settings.update",
            entityType: "AppSettings",
            entityId: "app",
            metadata: "{bad-json",
            createdAt: new Date("2026-06-22T12:00:00.000Z")
          }
        ],
        [campaign]
      )[0]
    ).toMatchObject({
      campaignTitle: undefined,
      campaignSlug: undefined,
      campaignStatus: undefined,
      action: "settings.update"
    });
  });

  it("returns a campaign id only when it matches a known campaign", () => {
    expect(campaignIdForAuditLog({ action: "x", entityType: "Campaign", entityId: "campaign_1", metadata: null, createdAt: new Date() }, new Set(["campaign_1"]))).toBe("campaign_1");
    expect(campaignIdForAuditLog({ action: "x", entityType: "Campaign", entityId: "missing", metadata: null, createdAt: new Date() }, new Set(["campaign_1"]))).toBeNull();
  });
});
