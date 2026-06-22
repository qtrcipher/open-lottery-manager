import { describe, expect, it } from "vitest";
import {
  auditExportWhere,
  entryExportWhere,
  filterCampaignContexts,
  globalExportHref,
  globalExportQueryString,
  parseGlobalExportFilters,
  winnerExportWhere
} from "./export-filters";

describe("parseGlobalExportFilters", () => {
  it("keeps valid campaign, status, and date filters", () => {
    const filters = parseGlobalExportFilters(
      new URLSearchParams({
        campaignId: "campaign_1",
        status: "OPEN",
        from: "2026-06-22T10:00",
        to: "2026-06-22T12:30"
      })
    );

    expect(filters).toMatchObject({
      campaignId: "campaign_1",
      status: "OPEN",
      fromInput: "2026-06-22T10:00",
      toInput: "2026-06-22T12:30"
    });
    expect(filters.fromDate).toBeInstanceOf(Date);
    expect(filters.toDate).toBeInstanceOf(Date);
  });

  it("ignores invalid status and dates", () => {
    expect(
      parseGlobalExportFilters({
        campaignId: "campaign_1",
        status: "BAD",
        from: "not-a-date",
        to: "also-bad"
      })
    ).toEqual({
      campaignId: "campaign_1",
      status: "",
      fromInput: "",
      toInput: "",
      fromDate: null,
      toDate: null
    });
  });
});

describe("global export query helpers", () => {
  it("serializes only active filters", () => {
    const filters = parseGlobalExportFilters({
      campaignId: "campaign_1",
      status: "DRAWN",
      from: "2026-06-22T10:00",
      to: ""
    });

    expect(globalExportQueryString(filters)).toBe("campaignId=campaign_1&status=DRAWN&from=2026-06-22T10%3A00");
    expect(globalExportHref("entries", filters)).toBe("/admin/exports/entries?campaignId=campaign_1&status=DRAWN&from=2026-06-22T10%3A00");
  });
});

describe("export Prisma filters", () => {
  const filters = parseGlobalExportFilters({
    campaignId: "campaign_1",
    status: "OPEN",
    from: "2026-06-22T10:00",
    to: "2026-06-22T12:30"
  });

  it("builds entry filters", () => {
    expect(entryExportWhere(filters)).toMatchObject({
      campaignId: "campaign_1",
      campaign: { status: "OPEN" }
    });
    expect(entryExportWhere(filters).createdAt).toBeTruthy();
  });

  it("builds winner filters through draw context", () => {
    expect(winnerExportWhere(filters)).toMatchObject({
      draw: {
        is: {
          campaignId: "campaign_1",
          campaign: { status: "OPEN" }
        }
      }
    });
  });

  it("builds audit filters from date and campaign id", () => {
    expect(auditExportWhere(filters)).toMatchObject({
      AND: [
        { createdAt: expect.any(Object) },
        {
          OR: [
            { entityType: "Campaign", entityId: "campaign_1" },
            { metadata: { contains: '"campaignId":"campaign_1"' } },
            { metadata: { contains: '"campaignId": "campaign_1"' } }
          ]
        }
      ]
    });
  });

  it("filters campaign contexts by campaign and status", () => {
    expect(
      filterCampaignContexts(
        [
          { id: "campaign_1", status: "OPEN", title: "One" },
          { id: "campaign_2", status: "DRAWN", title: "Two" }
        ],
        filters
      )
    ).toEqual([{ id: "campaign_1", status: "OPEN", title: "One" }]);
  });
});
