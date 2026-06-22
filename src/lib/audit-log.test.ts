import { describe, expect, it } from "vitest";
import {
  auditLogPageCount,
  auditLogQueryString,
  auditLogSkip,
  buildAuditLogWhere,
  campaignAuditBaseWhere,
  clampAuditLogPage,
  parseAuditLogFilters
} from "./audit-log";

describe("parseAuditLogFilters", () => {
  it("defaults empty filters", () => {
    expect(parseAuditLogFilters({})).toMatchObject({
      search: "",
      action: "",
      entityType: "",
      from: null,
      to: null,
      page: 1
    });
  });

  it("trims filters and parses valid dates", () => {
    const filters = parseAuditLogFilters({
      auditSearch: " entry ",
      auditAction: " entry.create ",
      auditEntityType: " Entry ",
      auditFrom: "2026-06-22T10:00",
      auditTo: "2026-06-22T12:30",
      auditPage: "3"
    });

    expect(filters.search).toBe("entry");
    expect(filters.action).toBe("entry.create");
    expect(filters.entityType).toBe("Entry");
    expect(filters.from?.toISOString()).toBe(new Date("2026-06-22T10:00").toISOString());
    expect(filters.to?.toISOString()).toBe(new Date("2026-06-22T12:30").toISOString());
    expect(filters.page).toBe(3);
  });

  it("ignores invalid dates and pages", () => {
    const filters = parseAuditLogFilters({
      auditFrom: "not-a-date",
      auditTo: "also-bad",
      auditPage: "-2"
    });

    expect(filters.from).toBeNull();
    expect(filters.to).toBeNull();
    expect(filters.page).toBe(1);
  });
});

describe("audit log query helpers", () => {
  it("builds campaign-related base where clause", () => {
    expect(campaignAuditBaseWhere("campaign-1")).toEqual({
      OR: [
        { entityType: "Campaign", entityId: "campaign-1" },
        { metadata: { contains: "campaign-1" } }
      ]
    });
  });

  it("builds search and exact filter clauses", () => {
    const filters = parseAuditLogFilters({
      auditSearch: "winner",
      auditAction: "draw.run",
      auditEntityType: "Draw",
      auditFrom: "2026-06-22T10:00",
      auditTo: "2026-06-22T11:00"
    });

    expect(buildAuditLogWhere("campaign-1", filters)).toEqual({
      AND: [
        campaignAuditBaseWhere("campaign-1"),
        {
          OR: [
            { action: { contains: "winner" } },
            { entityType: { contains: "winner" } },
            { entityId: { contains: "winner" } },
            { metadata: { contains: "winner" } }
          ]
        },
        { action: "draw.run" },
        { entityType: "Draw" },
        {
          createdAt: {
            gte: new Date("2026-06-22T10:00"),
            lte: new Date("2026-06-22T11:00")
          }
        }
      ]
    });
  });

  it("calculates pagination offsets and bounds", () => {
    expect(auditLogSkip(1)).toBe(0);
    expect(auditLogSkip(3)).toBe(50);
    expect(auditLogPageCount(0)).toBe(1);
    expect(auditLogPageCount(51)).toBe(3);
    expect(clampAuditLogPage(99, 51)).toBe(3);
  });

  it("serializes active filters into query strings", () => {
    const filters = parseAuditLogFilters({
      auditSearch: "entry",
      auditAction: "entry.create",
      auditEntityType: "Entry",
      auditFrom: "2026-06-22T10:00",
      auditTo: "2026-06-22T12:30",
      auditPage: "2"
    });

    expect(auditLogQueryString(filters, { page: 3 })).toBe(
      "auditSearch=entry&auditAction=entry.create&auditEntityType=Entry&auditFrom=2026-06-22T10%3A00&auditTo=2026-06-22T12%3A30&auditPage=3"
    );
  });
});
