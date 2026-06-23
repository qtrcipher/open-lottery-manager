import { describe, expect, it } from "vitest";
import { parseEntriesCsv, serializeCsv, validateEntriesCsv } from "./csv";

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

describe("validateEntriesCsv", () => {
  it("reports missing required headers", () => {
    const result = validateEntriesCsv("name,reference\nNoor,INV-1", []);

    expect(result.validRows).toHaveLength(0);
    expect(result.errorRows[0].message).toBe("CSV must include name and email headers.");
  });

  it("reports row-level missing values and invalid emails", () => {
    const result = validateEntriesCsv("name,email,reference\n,missing@example.com,INV-1\nOmar,not-an-email,INV-2", []);

    expect(result.validRows).toHaveLength(0);
    expect(result.errorRows.map((row) => row.message)).toEqual([
      "Row 2 must include name and email.",
      "Row 3 has an invalid email address."
    ]);
  });

  it("detects duplicate emails and references inside the CSV", () => {
    const result = validateEntriesCsv(
      "name,email,reference\nFatima,fatima@example.com,INV-1\nFatima Two,fatima@example.com,INV-2\nOmar,omar@example.com,INV-1",
      []
    );

    expect(result.validRows).toHaveLength(1);
    expect(result.errorRows.map((row) => row.message)).toEqual([
      "Row 3 duplicates another CSV email.",
      "Row 4 duplicates another CSV reference."
    ]);
  });

  it("detects duplicate emails and references against existing entries", () => {
    const result = validateEntriesCsv("name,email,reference\nFatima,fatima@example.com,INV-1\nOmar,omar@example.com,INV-2", [
      { email: "fatima@example.com", reference: null },
      { email: "existing@example.com", reference: "INV-2" }
    ]);

    expect(result.validRows).toHaveLength(0);
    expect(result.errorRows.map((row) => row.message)).toEqual([
      "Row 2 duplicates an existing campaign email.",
      "Row 3 duplicates an existing campaign reference."
    ]);
  });

  it("keeps valid quoted rows available for import", () => {
    const result = validateEntriesCsv('name,email,reference\n"Noor, Fatima",fatima@example.com,INV-1', []);

    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        name: "Noor, Fatima",
        email: "fatima@example.com",
        reference: "INV-1"
      }
    ]);
    expect(result.summary).toEqual({ totalRows: 1, validRows: 1, errorRows: 0 });
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

  it("neutralizes spreadsheet formula cells", () => {
    const csv = serializeCsv(["name", "reference", "quantity"], [
      {
        name: "=HYPERLINK(\"https://example.com\")",
        reference: "  @SUM(1,2)",
        quantity: -1
      }
    ]);

    expect(csv).toBe('name,reference,quantity\n"\'=HYPERLINK(""https://example.com"")","\'  @SUM(1,2)",-1\n');
  });
});
