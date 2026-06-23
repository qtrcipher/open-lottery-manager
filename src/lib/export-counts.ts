import { filterAuditLogsByCampaignContext, type CampaignExportContext, type GlobalAuditExportSource } from "./export-rows";
import { filterCampaignContexts, type GlobalExportFilters } from "./export-filters";

export type GlobalExportCounts = {
  entries: number;
  winners: number;
  audit: number;
};

export function auditExportCount(logs: GlobalAuditExportSource[], campaigns: CampaignExportContext[], filters: GlobalExportFilters): number {
  if (!filters.campaignId && !filters.status) {
    return logs.length;
  }

  return filterAuditLogsByCampaignContext(logs, filterCampaignContexts(campaigns, filters)).length;
}
