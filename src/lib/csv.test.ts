import { describe, expect, it } from "vitest";
import { parseEntriesCsv } from "./csv";

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
