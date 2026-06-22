import { describe, expect, it } from "vitest";
import { createHealthPayload } from "./health";

describe("createHealthPayload", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");

  it("creates an ok payload when the database is healthy", () => {
    expect(createHealthPayload({ databaseStatus: "ok", now, version: "1.2.3" })).toEqual({
      status: "ok",
      version: "1.2.3",
      database: {
        status: "ok"
      },
      timestamp: "2026-06-22T12:00:00.000Z"
    });
  });

  it("creates an error payload when the database check fails", () => {
    expect(createHealthPayload({ databaseStatus: "error", now, version: "1.2.3" })).toEqual({
      status: "error",
      version: "1.2.3",
      database: {
        status: "error"
      },
      timestamp: "2026-06-22T12:00:00.000Z"
    });
  });
});
