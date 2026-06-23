import { CampaignStatus, type Prisma } from "@prisma/client";

const campaignStatuses = new Set<string>(Object.values(CampaignStatus));

export const campaignStatusOptions = Object.values(CampaignStatus);

export type GlobalExportFilters = {
  campaignId: string;
  status: CampaignStatus | "";
  fromInput: string;
  toInput: string;
  fromDate: Date | null;
  toDate: Date | null;
};

type FilterParams = URLSearchParams | Record<string, string | string[] | undefined>;

function valueFor(params: FilterParams, key: string): string {
  if (params instanceof URLSearchParams) {
    return params.get(key)?.trim() ?? "";
  }

  const value = params[key];
  return Array.isArray(value) ? (value[0]?.trim() ?? "") : (value?.trim() ?? "");
}

function parseDateInput(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStatus(value: string): CampaignStatus | "" {
  return campaignStatuses.has(value) ? (value as CampaignStatus) : "";
}

export function parseGlobalExportFilters(params: FilterParams): GlobalExportFilters {
  const fromInput = valueFor(params, "from");
  const toInput = valueFor(params, "to");
  const fromDate = parseDateInput(fromInput);
  const toDate = parseDateInput(toInput);

  return {
    campaignId: valueFor(params, "campaignId"),
    status: parseStatus(valueFor(params, "status")),
    fromInput: fromDate ? fromInput : "",
    toInput: toDate ? toInput : "",
    fromDate,
    toDate
  };
}

export function globalExportQueryString(filters: GlobalExportFilters): string {
  const params = new URLSearchParams();

  if (filters.campaignId) {
    params.set("campaignId", filters.campaignId);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.fromDate && filters.fromInput) {
    params.set("from", filters.fromInput);
  }

  if (filters.toDate && filters.toInput) {
    params.set("to", filters.toInput);
  }

  return params.toString();
}

export function globalExportHref(kind: "entries" | "winners" | "audit", filters: GlobalExportFilters): string {
  const query = globalExportQueryString(filters);
  return `/admin/exports/${kind}${query ? `?${query}` : ""}`;
}

function dateRangeFilter(filters: GlobalExportFilters): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};

  if (filters.fromDate) {
    range.gte = filters.fromDate;
  }

  if (filters.toDate) {
    range.lte = filters.toDate;
  }

  return Object.keys(range).length > 0 ? range : undefined;
}

export function entryExportWhere(filters: GlobalExportFilters): Prisma.EntryWhereInput {
  return {
    campaignId: filters.campaignId || undefined,
    createdAt: dateRangeFilter(filters),
    campaign: filters.status ? { status: filters.status } : undefined
  };
}

export function winnerExportWhere(filters: GlobalExportFilters): Prisma.DrawWinnerWhereInput {
  const drawWhere: Prisma.DrawWhereInput = {
    campaignId: filters.campaignId || undefined,
    createdAt: dateRangeFilter(filters),
    campaign: filters.status ? { status: filters.status } : undefined
  };

  return {
    draw: Object.values(drawWhere).some(Boolean) ? { is: drawWhere } : undefined
  };
}

export function auditExportWhere(filters: GlobalExportFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  const createdAt = dateRangeFilter(filters);

  if (createdAt) {
    and.push({ createdAt });
  }

  if (filters.campaignId) {
    and.push({
      OR: [
        { entityType: "Campaign", entityId: filters.campaignId },
        { metadata: { contains: `"campaignId":"${filters.campaignId}"` } },
        { metadata: { contains: `"campaignId": "${filters.campaignId}"` } }
      ]
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function auditExportWhereForCampaignIds(filters: GlobalExportFilters, campaignIds: string[]): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  const createdAt = dateRangeFilter(filters);

  if (createdAt) {
    and.push({ createdAt });
  }

  if (campaignIds.length === 0) {
    and.push({ id: { in: [] } });
  } else {
    and.push({
      OR: campaignIds.flatMap((campaignId) => [
        { entityType: "Campaign", entityId: campaignId },
        { metadata: { contains: `"campaignId":"${campaignId}"` } },
        { metadata: { contains: `"campaignId": "${campaignId}"` } }
      ])
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function filterCampaignContexts<T extends { id: string; status: string }>(campaigns: T[], filters: GlobalExportFilters): T[] {
  return campaigns.filter((campaign) => {
    if (filters.campaignId && campaign.id !== filters.campaignId) {
      return false;
    }

    if (filters.status && campaign.status !== filters.status) {
      return false;
    }

    return true;
  });
}
