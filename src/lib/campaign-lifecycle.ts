export type CampaignStatusValue = "DRAFT" | "OPEN" | "LOCKED" | "DRAWN" | "ARCHIVED";

export type ArchiveMetadata = {
  previousStatus: CampaignStatusValue;
  previousIsPublic: boolean;
};

const restorableStatuses = new Set<CampaignStatusValue>(["DRAFT", "OPEN", "LOCKED", "DRAWN"]);

export function canDeleteCampaign(status: CampaignStatusValue, drawCount: number): boolean {
  return status === "DRAFT" && drawCount === 0;
}

export function canModifyCampaign(status: CampaignStatusValue): boolean {
  return status !== "ARCHIVED";
}

export function canEditCampaignSetup(status: CampaignStatusValue, drawCount: number): boolean {
  return status !== "ARCHIVED" && status !== "DRAWN" && drawCount === 0;
}

export function createArchiveMetadata(status: CampaignStatusValue, isPublic: boolean): ArchiveMetadata {
  return {
    previousStatus: status,
    previousIsPublic: isPublic
  };
}

export function parseArchiveMetadata(metadata?: string | null): ArchiveMetadata | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as Partial<ArchiveMetadata>;

    if (
      parsed.previousStatus &&
      restorableStatuses.has(parsed.previousStatus) &&
      typeof parsed.previousIsPublic === "boolean"
    ) {
      return {
        previousStatus: parsed.previousStatus,
        previousIsPublic: parsed.previousIsPublic
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function restoreCampaignState(drawCount: number, metadata?: string | null): ArchiveMetadata {
  const parsed = parseArchiveMetadata(metadata);

  if (parsed) {
    return parsed;
  }

  if (drawCount > 0) {
    return {
      previousStatus: "DRAWN",
      previousIsPublic: true
    };
  }

  return {
    previousStatus: "DRAFT",
    previousIsPublic: false
  };
}
