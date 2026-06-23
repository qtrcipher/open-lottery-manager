export type ParsedEntry = {
  name: string;
  email: string;
  reference?: string;
};

export type ExistingEntryIdentity = {
  email: string;
  reference?: string | null;
};

export type CsvImportRow = ParsedEntry & {
  rowNumber: number;
};

export type CsvImportError = {
  rowNumber: number;
  message: string;
  name?: string;
  email?: string;
  reference?: string;
};

export type CsvImportSummary = {
  totalRows: number;
  validRows: number;
  errorRows: number;
};

export type CsvImportValidation = {
  validRows: CsvImportRow[];
  errorRows: CsvImportError[];
  summary: CsvImportSummary;
};

export type CsvValue = string | number | boolean | Date | null | undefined;
export type CsvRow = Record<string, CsvValue>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!csv.trim()) {
    return [];
  }

  const result = validateEntriesCsv(csv, []);

  if (result.errorRows.length > 0) {
    throw new Error(result.errorRows[0].message);
  }

  return result.validRows.map(({ name, email, reference }) => ({ name, email, reference }));
}

function createSummary(validRows: CsvImportRow[], errorRows: CsvImportError[], totalRows: number): CsvImportSummary {
  return {
    totalRows,
    validRows: validRows.length,
    errorRows: errorRows.length
  };
}

function validationResult(validRows: CsvImportRow[], errorRows: CsvImportError[], totalRows: number): CsvImportValidation {
  return {
    validRows,
    errorRows,
    summary: createSummary(validRows, errorRows, totalRows)
  };
}

export function validateEntriesCsv(csv: string, existingEntries: ExistingEntryIdentity[]): CsvImportValidation {
  const lines = csv
    .split(/\r?\n/)
    .map((line, index) => ({ rowNumber: index + 1, value: line.trim() }))
    .filter((line) => line.value.length > 0);

  if (lines.length === 0) {
    return validationResult([], [{ rowNumber: 1, message: "CSV must include name and email headers." }], 0);
  }

  const headers = splitCsvLine(lines[0].value).map((header) => header.toLowerCase());
  const nameIndex = headers.indexOf("name");
  const emailIndex = headers.indexOf("email");
  const referenceIndex = headers.indexOf("reference");
  const totalRows = Math.max(lines.length - 1, 0);

  if (nameIndex === -1 || emailIndex === -1) {
    return validationResult([], [{ rowNumber: lines[0].rowNumber, message: "CSV must include name and email headers." }], totalRows);
  }

  const existingEmails = new Set(existingEntries.map((entry) => entry.email.toLowerCase()));
  const existingReferences = new Set<string>();
  for (const entry of existingEntries) {
    const reference = entry.reference?.trim();
    if (reference) {
      existingReferences.add(reference);
    }
  }
  const seenEmails = new Set<string>();
  const seenReferences = new Set<string>();
  const validRows: CsvImportRow[] = [];
  const errorRows: CsvImportError[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line.value);
    const name = cells[nameIndex]?.trim() ?? "";
    const email = cells[emailIndex]?.trim().toLowerCase() ?? "";
    const reference = referenceIndex === -1 ? "" : cells[referenceIndex]?.trim() ?? "";
    const rowErrors: string[] = [];

    if (!name || !email) {
      rowErrors.push(`Row ${line.rowNumber} must include name and email.`);
    }

    if (email && !emailPattern.test(email)) {
      rowErrors.push(`Row ${line.rowNumber} has an invalid email address.`);
    }

    if (email && seenEmails.has(email)) {
      rowErrors.push(`Row ${line.rowNumber} duplicates another CSV email.`);
    }

    if (email && existingEmails.has(email)) {
      rowErrors.push(`Row ${line.rowNumber} duplicates an existing campaign email.`);
    }

    if (reference && seenReferences.has(reference)) {
      rowErrors.push(`Row ${line.rowNumber} duplicates another CSV reference.`);
    }

    if (reference && existingReferences.has(reference)) {
      rowErrors.push(`Row ${line.rowNumber} duplicates an existing campaign reference.`);
    }

    if (rowErrors.length > 0) {
      errorRows.push({
        rowNumber: line.rowNumber,
        message: rowErrors.join(" "),
        name,
        email,
        reference: reference || undefined
      });
      continue;
    }

    seenEmails.add(email);
    if (reference) {
      seenReferences.add(reference);
    }
    validRows.push({
      rowNumber: line.rowNumber,
      name,
      email,
      reference: reference || undefined
    });
  }

  return validationResult(validRows, errorRows, totalRows);
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

function neutralizeSpreadsheetFormula(value: CsvValue, formatted: string): string {
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(formatted)) {
    return `'${formatted}`;
  }

  return formatted;
}

function escapeCsvCell(value: CsvValue): string {
  const formatted = neutralizeSpreadsheetFormula(value, formatCsvValue(value));
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
