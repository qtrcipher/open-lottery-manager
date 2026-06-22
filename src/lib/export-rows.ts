import type { CsvRow } from "./csv";

export type CampaignExportContext = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

export type GlobalEntryExportSource = {
  campaign: CampaignExportContext;
  ticketCode: string;
  name: string;
  email: string;
  reference: string | null;
  isEligible: boolean;
  createdAt: Date;
};

export type GlobalWinnerExportSource = {
  rank: number;
  prize: {
    name: string;
  };
  entry: {
    ticketCode: string;
    name: string;
    email: string;
    reference: string | null;
  };
  draw: {
    seedHash: string;
    algorithmVersion: string;
    createdAt: Date;
    campaign: CampaignExportContext;
  };
};

export type GlobalAuditExportSource = {
  action: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  createdAt: Date;
};

export const globalEntryHeaders = [
  "campaignTitle",
  "campaignSlug",
  "campaignStatus",
  "ticketCode",
  "name",
  "email",
  "reference",
  "isEligible",
  "createdAt"
];

export const globalWinnerHeaders = [
  "campaignTitle",
  "campaignSlug",
  "campaignStatus",
  "rank",
  "prizeName",
  "ticketCode",
  "name",
  "email",
  "reference",
  "drawSeedHash",
  "algorithmVersion",
  "drawnAt"
];

export const globalAuditHeaders = [
  "campaignTitle",
  "campaignSlug",
  "campaignStatus",
  "action",
  "entityType",
  "entityId",
  "metadata",
  "createdAt"
];

export function globalEntryRows(entries: GlobalEntryExportSource[]): CsvRow[] {
  return entries.map((entry) => ({
    campaignTitle: entry.campaign.title,
    campaignSlug: entry.campaign.slug,
    campaignStatus: entry.campaign.status,
    ticketCode: entry.ticketCode,
    name: entry.name,
    email: entry.email,
    reference: entry.reference,
    isEligible: entry.isEligible,
    createdAt: entry.createdAt
  }));
}

export function globalWinnerRows(winners: GlobalWinnerExportSource[]): CsvRow[] {
  return winners.map((winner) => ({
    campaignTitle: winner.draw.campaign.title,
    campaignSlug: winner.draw.campaign.slug,
    campaignStatus: winner.draw.campaign.status,
    rank: winner.rank,
    prizeName: winner.prize.name,
    ticketCode: winner.entry.ticketCode,
    name: winner.entry.name,
    email: winner.entry.email,
    reference: winner.entry.reference,
    drawSeedHash: winner.draw.seedHash,
    algorithmVersion: winner.draw.algorithmVersion,
    drawnAt: winner.draw.createdAt
  }));
}

export function campaignIdForAuditLog(log: GlobalAuditExportSource, campaignIds: Set<string>): string | null {
  if (log.entityType === "Campaign" && campaignIds.has(log.entityId)) {
    return log.entityId;
  }

  if (!log.metadata) {
    return null;
  }

  try {
    const metadata = JSON.parse(log.metadata) as { campaignId?: unknown };

    return typeof metadata.campaignId === "string" && campaignIds.has(metadata.campaignId) ? metadata.campaignId : null;
  } catch {
    return null;
  }
}

export function globalAuditRows(logs: GlobalAuditExportSource[], campaigns: CampaignExportContext[]): CsvRow[] {
  const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const campaignIds = new Set(campaignsById.keys());

  return logs.map((log) => {
    const campaign = campaignsById.get(campaignIdForAuditLog(log, campaignIds) ?? "");

    return {
      campaignTitle: campaign?.title,
      campaignSlug: campaign?.slug,
      campaignStatus: campaign?.status,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt
    };
  });
}

export function filterAuditLogsByCampaignContext(logs: GlobalAuditExportSource[], campaigns: CampaignExportContext[]): GlobalAuditExportSource[] {
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));

  return logs.filter((log) => {
    const campaignId = campaignIdForAuditLog(log, campaignIds);
    return Boolean(campaignId);
  });
}
