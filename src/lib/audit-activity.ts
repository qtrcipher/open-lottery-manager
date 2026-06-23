export type ActivityCampaignContext = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

export type ActivityLogSource = {
  action: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  createdAt: Date;
};

export type RecentActivityItem = ActivityLogSource & {
  campaign: ActivityCampaignContext | null;
};

export function campaignIdForActivityLog(log: ActivityLogSource, campaignIds: Set<string>): string | null {
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

export function recentActivityItems(logs: ActivityLogSource[], campaigns: ActivityCampaignContext[]): RecentActivityItem[] {
  const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const campaignIds = new Set(campaignsById.keys());

  return logs.map((log) => {
    const campaignId = campaignIdForActivityLog(log, campaignIds);

    return {
      ...log,
      campaign: campaignId ? (campaignsById.get(campaignId) ?? null) : null
    };
  });
}
