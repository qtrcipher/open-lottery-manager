import type { Prisma } from "@prisma/client";

export const auditLogPageSize = 25;

export type AuditLogFilters = {
  search: string;
  action: string;
  entityType: string;
  fromInput: string;
  toInput: string;
  from: Date | null;
  to: Date | null;
  page: number;
};

export type AuditLogSearchParams = {
  auditSearch?: string;
  auditAction?: string;
  auditEntityType?: string;
  auditFrom?: string;
  auditTo?: string;
  auditPage?: string;
};

function clean(value?: string): string {
  return String(value ?? "").trim();
}

function parseDateInput(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePage(value?: string): number {
  const page = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseAuditLogFilters(params: AuditLogSearchParams): AuditLogFilters {
  const fromInput = clean(params.auditFrom);
  const toInput = clean(params.auditTo);

  return {
    search: clean(params.auditSearch),
    action: clean(params.auditAction),
    entityType: clean(params.auditEntityType),
    fromInput,
    toInput,
    from: parseDateInput(fromInput),
    to: parseDateInput(toInput),
    page: parsePage(params.auditPage)
  };
}

export function campaignAuditBaseWhere(campaignId: string): Prisma.AuditLogWhereInput {
  return {
    OR: [
      { entityType: "Campaign", entityId: campaignId },
      { metadata: { contains: campaignId } }
    ]
  };
}

export function buildAuditLogWhere(campaignId: string, filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const clauses: Prisma.AuditLogWhereInput[] = [campaignAuditBaseWhere(campaignId)];

  if (filters.search) {
    clauses.push({
      OR: [
        { action: { contains: filters.search } },
        { entityType: { contains: filters.search } },
        { entityId: { contains: filters.search } },
        { metadata: { contains: filters.search } }
      ]
    });
  }

  if (filters.action) {
    clauses.push({ action: filters.action });
  }

  if (filters.entityType) {
    clauses.push({ entityType: filters.entityType });
  }

  if (filters.from || filters.to) {
    clauses.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      }
    });
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

export function auditLogSkip(page: number): number {
  return (Math.max(1, page) - 1) * auditLogPageSize;
}

export function auditLogPageCount(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / auditLogPageSize));
}

export function clampAuditLogPage(page: number, totalCount: number): number {
  return Math.min(Math.max(1, page), auditLogPageCount(totalCount));
}

export function auditLogQueryString(filters: AuditLogFilters, overrides: Partial<Pick<AuditLogFilters, "page">> = {}): string {
  const page = overrides.page ?? filters.page;
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("auditSearch", filters.search);
  }

  if (filters.action) {
    params.set("auditAction", filters.action);
  }

  if (filters.entityType) {
    params.set("auditEntityType", filters.entityType);
  }

  if (filters.from) {
    params.set("auditFrom", filters.fromInput);
  }

  if (filters.to) {
    params.set("auditTo", filters.toInput);
  }

  if (page > 1) {
    params.set("auditPage", String(page));
  }

  return params.toString();
}
