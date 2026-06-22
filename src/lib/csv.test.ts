import { describe, expect, it } from "vitest";
import { parseEntriesCsv, serializeCsv } from "./csv";

describe("parseEntriesCsv", () => {
  it("parses entries with optional references", () => {
    const rows = parseEntriesCsv("name,email,reference\nFatima Noor,FATIMA@example.com,INV-1\nOmar Ali,omar@example.com,");

    expect(rows).toEqual([
      { name: "Fatima Noor", email: "fatima@example.com", reference: "INV-1" },
      { name: "Omar Ali", email: "omar@example.com", reference: undefined }
    ]);
  });

  it("handles quoted commas", () => {
    const rows = parseEntriesCsv('name,email,reference\n"Noor, Fatima",fatima@example.com,INV-1');

    expect(rows[0].name).toBe("Noor, Fatima");
  });

  it("requires name and email headers", () => {
    expect(() => parseEntriesCsv("name,reference\nNoor,INV-1")).toThrow("CSV must include name and email headers.");
  });
});

describe("serializeCsv", () => {
  it("preserves header order and formats scalar values", () => {
    const csv = serializeCsv(["ticketCode", "isEligible", "createdAt", "reference"], [
      {
        ticketCode: "TICKET-1",
        isEligible: true,
        createdAt: new Date("2026-06-22T10:00:00.000Z"),
        reference: undefined
      }
    ]);

    expect(csv).toBe("ticketCode,isEligible,createdAt,reference\nTICKET-1,true,2026-06-22T10:00:00.000Z,\n");
  });

  it("escapes quotes, commas, and newlines", () => {
    const csv = serializeCsv(["name", "reference"], [
      {
        name: 'Noor "Winner", Fatima',
        reference: "INV-1\nINV-2"
      }
    ]);

    expect(csv).toBe('name,reference\n"Noor ""Winner"", Fatima","INV-1\nINV-2"\n');
  });

  it("serializes null and undefined as empty cells", () => {
    const csv = serializeCsv(["name", "email"], [
      {
        name: null,
        email: undefined
      }
    ]);

    expect(csv).toBe("name,email\n,\n");
  });
});
