import { describe, expect, it } from "vitest";
import { createHealthPayload, formatUptime, getConfiguredPublicUrl } from "./health";

describe("createHealthPayload", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");

  it("creates an ok payload when the database is healthy", () => {
    expect(createHealthPayload({ databaseStatus: "ok", now, publicUrl: "https://example.com/", uptimeSeconds: 90.9, version: "1.2.3" })).toEqual({
      status: "ok",
      version: "1.2.3",
      database: {
        status: "ok"
      },
      uptime: {
        seconds: 90,
        display: "1m 30s"
      },
      publicUrl: "https://example.com",
      timestamp: "2026-06-22T12:00:00.000Z"
    });
  });

  it("creates an error payload when the database check fails", () => {
    expect(createHealthPayload({ databaseStatus: "error", now, publicUrl: null, uptimeSeconds: 0, version: "1.2.3" })).toEqual({
      status: "error",
      version: "1.2.3",
      database: {
        status: "error"
      },
      uptime: {
        seconds: 0,
        display: "0s"
      },
      publicUrl: null,
      timestamp: "2026-06-22T12:00:00.000Z"
    });
  });

  it("normalizes configured public URLs", () => {
    expect(getConfiguredPublicUrl(" https://lottery.example.com/// ")).toBe("https://lottery.example.com");
    expect(getConfiguredPublicUrl("   ")).toBeNull();
    expect(getConfiguredPublicUrl(undefined)).toBeNull();
  });

  it("formats uptime for dashboard display", () => {
    expect(formatUptime(45)).toBe("45s");
    expect(formatUptime(125)).toBe("2m 5s");
    expect(formatUptime(7_230)).toBe("2h 0m");
    expect(formatUptime(93_600)).toBe("1d 2h");
  });
});
