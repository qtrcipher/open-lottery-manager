export type ParsedEntry = {
  name: string;
  email: string;
  reference?: string;
};

export type CsvValue = string | number | boolean | Date | null | undefined;
export type CsvRow = Record<string, CsvValue>;

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function parseEntriesCsv(csv: string): ParsedEntry[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const nameIndex = headers.indexOf("name");
  const emailIndex = headers.indexOf("email");
  const referenceIndex = headers.indexOf("reference");

  if (nameIndex === -1 || emailIndex === -1) {
    throw new Error("CSV must include name and email headers.");
  }

  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const name = cells[nameIndex]?.trim();
    const email = cells[emailIndex]?.trim().toLowerCase();
    const reference = cells[referenceIndex]?.trim();

    if (!name || !email) {
      throw new Error(`Row ${rowIndex + 2} must include name and email.`);
    }

    return {
      name,
      email,
      reference: reference || undefined
    };
  });
}

function formatCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function escapeCsvCell(value: CsvValue): string {
  const formatted = formatCsvValue(value);
  const escaped = formatted.replaceAll('"', '""');

  if (/[",\r\n]/.test(escaped)) {
    return `"${escaped}"`;
  }

  return escaped;
}

export function serializeCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [
    headers.map((header) => escapeCsvCell(header)).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(","))
  ];

  return `${lines.join("\n")}\n`;
}
