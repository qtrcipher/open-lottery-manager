import { describe, expect, it } from "vitest";
import {
  canAcceptPublicEntries,
  canDeleteCampaign,
  canEditCampaignSetup,
  canModifyCampaign,
  createArchiveMetadata,
  parseArchiveMetadata,
  restoreCampaignState
} from "./campaign-lifecycle";

describe("campaign lifecycle policy", () => {
  it("only allows delete for draft campaigns without draws", () => {
    expect(canDeleteCampaign("DRAFT", 0)).toBe(true);
    expect(canDeleteCampaign("DRAFT", 1)).toBe(false);
    expect(canDeleteCampaign("OPEN", 0)).toBe(false);
    expect(canDeleteCampaign("DRAWN", 0)).toBe(false);
    expect(canDeleteCampaign("ARCHIVED", 0)).toBe(false);
  });

  it("blocks content changes while archived", () => {
    expect(canModifyCampaign("ARCHIVED")).toBe(false);
    expect(canModifyCampaign("DRAFT")).toBe(true);
    expect(canModifyCampaign("DRAWN")).toBe(true);
  });

  it("locks setup changes after archive or draw", () => {
    expect(canEditCampaignSetup("DRAFT", 0)).toBe(true);
    expect(canEditCampaignSetup("OPEN", 0)).toBe(true);
    expect(canEditCampaignSetup("ARCHIVED", 0)).toBe(false);
    expect(canEditCampaignSetup("DRAWN", 0)).toBe(false);
    expect(canEditCampaignSetup("OPEN", 1)).toBe(false);
  });

  it("only accepts public entries for open published campaigns inside the date window", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");

    expect(
      canAcceptPublicEntries({
        status: "OPEN",
        isPublic: true,
        allowPublicEntries: true,
        startsAt: new Date("2026-06-22T10:00:00.000Z"),
        endsAt: new Date("2026-06-22T14:00:00.000Z"),
        drawCount: 0,
        now
      })
    ).toBe(true);

    expect(canAcceptPublicEntries({ status: "DRAFT", isPublic: true, allowPublicEntries: true, drawCount: 0, now })).toBe(false);
    expect(canAcceptPublicEntries({ status: "OPEN", isPublic: false, allowPublicEntries: true, drawCount: 0, now })).toBe(false);
    expect(canAcceptPublicEntries({ status: "OPEN", isPublic: true, allowPublicEntries: false, drawCount: 0, now })).toBe(false);
    expect(canAcceptPublicEntries({ status: "OPEN", isPublic: true, allowPublicEntries: true, drawCount: 1, now })).toBe(false);
    expect(
      canAcceptPublicEntries({
        status: "OPEN",
        isPublic: true,
        allowPublicEntries: true,
        startsAt: new Date("2026-06-22T13:00:00.000Z"),
        drawCount: 0,
        now
      })
    ).toBe(false);
    expect(
      canAcceptPublicEntries({
        status: "OPEN",
        isPublic: true,
        allowPublicEntries: true,
        endsAt: new Date("2026-06-22T11:00:00.000Z"),
        drawCount: 0,
        now
      })
    ).toBe(false);
  });

  it("creates and parses archive metadata", () => {
    const metadata = createArchiveMetadata("OPEN", true);

    expect(parseArchiveMetadata(JSON.stringify(metadata))).toEqual({
      previousStatus: "OPEN",
      previousIsPublic: true
    });
  });

  it("ignores invalid archive metadata", () => {
    expect(parseArchiveMetadata("{bad json")).toBeNull();
    expect(parseArchiveMetadata(JSON.stringify({ previousStatus: "ARCHIVED", previousIsPublic: true }))).toBeNull();
    expect(parseArchiveMetadata(JSON.stringify({ previousStatus: "OPEN" }))).toBeNull();
  });

  it("restores from metadata when available", () => {
    const metadata = JSON.stringify({ previousStatus: "LOCKED", previousIsPublic: false });

    expect(restoreCampaignState(1, metadata)).toEqual({
      previousStatus: "LOCKED",
      previousIsPublic: false
    });
  });

  it("falls back to draw state when archive metadata is unavailable", () => {
    expect(restoreCampaignState(1, null)).toEqual({
      previousStatus: "DRAWN",
      previousIsPublic: true
    });
    expect(restoreCampaignState(0, null)).toEqual({
      previousStatus: "DRAFT",
      previousIsPublic: false
    });
  });
});
