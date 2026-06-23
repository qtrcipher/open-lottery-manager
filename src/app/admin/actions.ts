"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertAppSettings } from "@/lib/app-settings";
import {
  canDeleteCampaign,
  canEditCampaignSetup,
  canModifyCampaign,
  createArchiveMetadata,
  restoreCampaignState,
  type CampaignStatusValue
} from "@/lib/campaign-lifecycle";
import { type CsvImportError, type CsvImportRow, type CsvImportSummary, validateEntriesCsv } from "@/lib/csv";
import { drawAlgorithmVersion, selectWinners } from "@/lib/draw";
import { buildDrawVerificationBundle, createDrawEntryManifest, createVerificationBundleHash } from "@/lib/draw-verification";
import { isApprovedForDraw } from "@/lib/abuse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { createTicketCode } from "@/lib/tickets";
import { appSettingsSchema, campaignSchema, entrySchema, entryUpdateSchema, prizeSchema, prizeUpdateSchema } from "@/lib/validators";

function optionalDate(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function writeAudit(action: string, entityType: string, entityId: string, metadata?: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    }
  });
}

function isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function uniqueFailureCode(error: Prisma.PrismaClientKnownRequestError): string {
  const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");

  if (target.includes("email")) {
    return "duplicate-email";
  }

  if (target.includes("reference")) {
    return "duplicate-reference";
  }

  return "duplicate";
}

function asCampaignStatus(status: string): CampaignStatusValue {
  return status as CampaignStatusValue;
}

function lockedCampaignError(): Error {
  return new Error("Campaign setup, entries, and prizes are locked after a draw or archive.");
}

function redirectToCampaignAdmin(campaignId: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`/admin/campaigns/${campaignId}?${searchParams.toString()}`);
}

function entryReturnParams(formData: FormData, message: string): Record<string, string> {
  const params: Record<string, string> = { entryMessage: message };
  const entrySearch = formString(formData, "returnEntrySearch");
  const entryStatus = formString(formData, "returnEntryStatus");

  if (entrySearch) {
    params.entrySearch = entrySearch;
  }

  if (entryStatus && entryStatus !== "all") {
    params.entryStatus = entryStatus;
  }

  return params;
}

export type EntryImportActionState = {
  status: "idle" | "preview" | "imported" | "error";
  message: string;
  csv: string;
  summary: CsvImportSummary;
  errors: CsvImportError[];
  previewRows: CsvImportRow[];
};

function emptyImportSummary(): CsvImportSummary {
  return {
    totalRows: 0,
    validRows: 0,
    errorRows: 0
  };
}

function importState({
  status,
  message,
  csv,
  summary = emptyImportSummary(),
  errors = [],
  previewRows = []
}: {
  status: EntryImportActionState["status"];
  message: string;
  csv: string;
  summary?: CsvImportSummary;
  errors?: CsvImportError[];
  previewRows?: CsvImportRow[];
}): EntryImportActionState {
  return {
    status,
    message,
    csv,
    summary,
    errors,
    previewRows
  };
}

async function requireEditableCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, slug: true, status: true, _count: { select: { draws: true } } }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (!canEditCampaignSetup(asCampaignStatus(campaign.status), campaign._count.draws)) {
    throw new Error("Campaign setup, entries, and prizes are locked after a draw or archive.");
  }

  return campaign;
}

async function lockEditableCampaign(tx: Prisma.TransactionClient, campaignId: string) {
  const locked = await tx.campaign.updateMany({
    where: {
      id: campaignId,
      status: { notIn: ["ARCHIVED", "DRAWN"] },
      draws: { none: {} }
    },
    data: { updatedAt: new Date() }
  });

  if (locked.count !== 1) {
    throw lockedCampaignError();
  }

  return tx.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { id: true, slug: true, status: true, _count: { select: { draws: true } } }
  });
}

async function createEntryWithTicket({
  campaignId,
  name,
  email,
  reference,
  tx = prisma
}: {
  campaignId: string;
  name: string;
  email: string;
  reference?: string;
  tx?: Prisma.TransactionClient | typeof prisma;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await tx.entry.create({
        data: {
          campaignId,
          name,
          email,
          reference,
          ticketCode: createTicketCode()
        }
      });
    } catch (error) {
      if (isUniqueError(error) && uniqueFailureCode(error) === "duplicate") {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to create a unique ticket code.");
}

export async function createCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = campaignSchema.parse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    rules: formString(formData, "rules"),
    timezone: formString(formData, "timezone") || "UTC",
    drawScheduledAt: formString(formData, "drawScheduledAt"),
    sponsorName: formString(formData, "sponsorName"),
    eligibilitySummary: formString(formData, "eligibilitySummary"),
    prizeValueSummary: formString(formData, "prizeValueSummary"),
    jurisdictionNotice: formString(formData, "jurisdictionNotice"),
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    isPublic: formData.get("isPublic") === "on",
    allowPublicEntries: formData.get("allowPublicEntries") === "on",
    requireLookupReference: formData.get("requireLookupReference") === "on"
  });

  const baseSlug = slugify(parsed.title) || `campaign-${Date.now()}`;
  const campaign = await prisma.campaign.create({
    data: {
      title: parsed.title,
      slug: baseSlug,
      description: parsed.description,
      rules: parsed.rules,
      timezone: parsed.timezone,
      drawScheduledAt: optionalDate(parsed.drawScheduledAt),
      sponsorName: parsed.sponsorName,
      eligibilitySummary: parsed.eligibilitySummary,
      prizeValueSummary: parsed.prizeValueSummary,
      jurisdictionNotice: parsed.jurisdictionNotice,
      startsAt: optionalDate(parsed.startsAt),
      endsAt: optionalDate(parsed.endsAt),
      isPublic: parsed.isPublic,
      allowPublicEntries: parsed.isPublic && parsed.allowPublicEntries,
      requireLookupReference: parsed.requireLookupReference,
      status: parsed.isPublic ? "OPEN" : "DRAFT"
    }
  }).catch(async (error) => {
    if (!isUniqueError(error)) {
      throw error;
    }

    return prisma.campaign.create({
      data: {
        title: parsed.title,
        slug: `${baseSlug}-${Date.now()}`,
        description: parsed.description,
        rules: parsed.rules,
        timezone: parsed.timezone,
        drawScheduledAt: optionalDate(parsed.drawScheduledAt),
        sponsorName: parsed.sponsorName,
        eligibilitySummary: parsed.eligibilitySummary,
        prizeValueSummary: parsed.prizeValueSummary,
        jurisdictionNotice: parsed.jurisdictionNotice,
        startsAt: optionalDate(parsed.startsAt),
        endsAt: optionalDate(parsed.endsAt),
        isPublic: parsed.isPublic,
        allowPublicEntries: parsed.isPublic && parsed.allowPublicEntries,
        requireLookupReference: parsed.requireLookupReference,
        status: parsed.isPublic ? "OPEN" : "DRAFT"
      }
    });
  });

  await writeAudit("campaign.create", "Campaign", campaign.id, { admin: admin.email });
  revalidatePath("/");
  redirect(`/admin/campaigns/${campaign.id}`);
}

export async function updateCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const parsed = campaignSchema.parse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    rules: formString(formData, "rules"),
    timezone: formString(formData, "timezone") || "UTC",
    drawScheduledAt: formString(formData, "drawScheduledAt"),
    sponsorName: formString(formData, "sponsorName"),
    eligibilitySummary: formString(formData, "eligibilitySummary"),
    prizeValueSummary: formString(formData, "prizeValueSummary"),
    jurisdictionNotice: formString(formData, "jurisdictionNotice"),
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    isPublic: formData.get("isPublic") === "on",
    allowPublicEntries: formData.get("allowPublicEntries") === "on",
    requireLookupReference: formData.get("requireLookupReference") === "on"
  });

  await prisma.$transaction(async (tx) => {
    await lockEditableCampaign(tx, campaignId);
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        title: parsed.title,
        description: parsed.description,
        rules: parsed.rules,
        timezone: parsed.timezone,
        drawScheduledAt: optionalDate(parsed.drawScheduledAt),
        sponsorName: parsed.sponsorName,
        eligibilitySummary: parsed.eligibilitySummary,
        prizeValueSummary: parsed.prizeValueSummary,
        jurisdictionNotice: parsed.jurisdictionNotice,
        startsAt: optionalDate(parsed.startsAt),
        endsAt: optionalDate(parsed.endsAt),
        isPublic: parsed.isPublic,
        allowPublicEntries: parsed.isPublic && parsed.allowPublicEntries,
        requireLookupReference: parsed.requireLookupReference,
        status: parsed.isPublic ? "OPEN" : "DRAFT"
      }
    });

    await tx.auditLog.create({
      data: {
        action: "campaign.update",
        entityType: "Campaign",
        entityId: campaignId,
        metadata: JSON.stringify({ admin: admin.email })
      }
    });
  });

  revalidatePath("/");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function addPrizeAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const parsed = prizeSchema.parse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    quantity: formData.get("quantity"),
    sortOrder: formData.get("sortOrder") || 0
  });

  const { campaign, prize } = await prisma.$transaction(async (tx) => {
    const campaign = await lockEditableCampaign(tx, campaignId);
    const prize = await tx.prize.create({
      data: {
        campaignId,
        name: parsed.name,
        description: parsed.description || null,
        quantity: parsed.quantity,
        sortOrder: parsed.sortOrder
      }
    });

    await tx.auditLog.create({
      data: {
        action: "prize.create",
        entityType: "Prize",
        entityId: prize.id,
        metadata: JSON.stringify({ admin: admin.email, campaignId })
      }
    });

    return { campaign, prize };
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaignAdmin(campaignId, { prizeMessage: "created" });
}

export async function updatePrizeAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const prizeId = formString(formData, "prizeId");
  const parsed = prizeUpdateSchema.parse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    quantity: formData.get("quantity"),
    sortOrder: formData.get("sortOrder") || 0
  });

  const { campaign } = await prisma.$transaction(async (tx) => {
    const campaign = await lockEditableCampaign(tx, campaignId);
    const existing = await tx.prize.findFirst({
      where: { id: prizeId, campaignId },
      select: { id: true }
    });

    if (!existing) {
      throw new Error("Prize not found.");
    }

    await tx.prize.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        description: parsed.description,
        quantity: parsed.quantity,
        sortOrder: parsed.sortOrder
      }
    });

    await tx.auditLog.create({
      data: {
        action: "prize.update",
        entityType: "Prize",
        entityId: existing.id,
        metadata: JSON.stringify({ admin: admin.email, campaignId })
      }
    });

    return { campaign };
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaignAdmin(campaignId, { prizeMessage: "updated" });
}

export async function deletePrizeAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const prizeId = formString(formData, "prizeId");
  const { campaign } = await prisma.$transaction(async (tx) => {
    const campaign = await lockEditableCampaign(tx, campaignId);
    const existing = await tx.prize.findFirst({
      where: { id: prizeId, campaignId },
      select: { id: true, name: true, description: true, quantity: true, sortOrder: true }
    });

    if (!existing) {
      throw new Error("Prize not found.");
    }

    await tx.prize.delete({ where: { id: existing.id } });
    await tx.auditLog.create({
      data: {
        action: "prize.delete",
        entityType: "Prize",
        entityId: existing.id,
        metadata: JSON.stringify({
          admin: admin.email,
          campaignId,
          name: existing.name,
          description: existing.description,
          quantity: existing.quantity,
          sortOrder: existing.sortOrder
        })
      }
    });

    return { campaign };
  });
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaignAdmin(campaignId, { prizeMessage: "deleted" });
}

export async function addEntryAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const parsed = entrySchema.parse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    reference: formString(formData, "reference") || undefined
  });

  let entry;
  let campaign;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const campaign = await lockEditableCampaign(tx, campaignId);
      const entry = await createEntryWithTicket({
        campaignId,
        name: parsed.name,
        email: parsed.email,
        reference: parsed.reference,
        tx
      });

      await tx.auditLog.create({
        data: {
          action: "entry.create",
          entityType: "Entry",
          entityId: entry.id,
          metadata: JSON.stringify({ admin: admin.email, campaignId })
        }
      });

      return { campaign, entry };
    });
    campaign = result.campaign;
    entry = result.entry;
  } catch (error) {
    if (isUniqueError(error)) {
      redirectToCampaignAdmin(campaignId, { entryMessage: uniqueFailureCode(error) });
    }

    throw error;
  }

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaignAdmin(campaignId, { entryMessage: "created" });
}

export async function updateEntryAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const entryId = formString(formData, "entryId");
  const parsed = entryUpdateSchema.parse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    reference: formString(formData, "reference"),
    isEligible: formData.get("isEligible") === "on",
    reviewStatus: formString(formData, "reviewStatus") || "APPROVED",
    reviewNotes: formString(formData, "reviewNotes")
  });

  let campaign;
  try {
    campaign = await prisma.$transaction(async (tx) => {
      const campaign = await lockEditableCampaign(tx, campaignId);
      const existing = await tx.entry.findFirst({
        where: { id: entryId, campaignId },
        select: { id: true, ticketCode: true }
      });

      if (!existing) {
        throw new Error("Entry not found.");
      }

      await tx.entry.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          email: parsed.email,
          reference: parsed.reference,
          isEligible: parsed.isEligible,
          reviewStatus: parsed.reviewStatus,
          reviewNotes: parsed.reviewNotes
        }
      });

      await tx.auditLog.create({
        data: {
          action: "entry.update",
          entityType: "Entry",
          entityId: existing.id,
          metadata: JSON.stringify({
            admin: admin.email,
            campaignId,
            ticketCode: existing.ticketCode,
            reviewStatus: parsed.reviewStatus
          })
        }
      });

      return campaign;
    });
  } catch (error) {
    if (isUniqueError(error)) {
      redirectToCampaignAdmin(campaignId, entryReturnParams(formData, uniqueFailureCode(error)));
    }

    throw error;
  }

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaignAdmin(campaignId, entryReturnParams(formData, "updated"));
}

export async function deleteEntryAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const entryId = formString(formData, "entryId");
  const campaign = await prisma.$transaction(async (tx) => {
    const campaign = await lockEditableCampaign(tx, campaignId);
    const existing = await tx.entry.findFirst({
      where: { id: entryId, campaignId },
      select: { id: true, name: true, email: true, reference: true, ticketCode: true }
    });

    if (!existing) {
      throw new Error("Entry not found.");
    }

    await tx.entry.delete({ where: { id: existing.id } });
    await tx.auditLog.create({
      data: {
        action: "entry.delete",
        entityType: "Entry",
        entityId: existing.id,
        metadata: JSON.stringify({
          admin: admin.email,
          campaignId,
          name: existing.name,
          email: existing.email,
          reference: existing.reference,
          ticketCode: existing.ticketCode
        })
      }
    });

    return campaign;
  });
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaignAdmin(campaignId, entryReturnParams(formData, "deleted"));
}

export async function previewEntriesImportAction(_previousState: EntryImportActionState, formData: FormData): Promise<EntryImportActionState> {
  await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const csv = String(formData.get("csv") ?? "");
  await requireEditableCampaign(campaignId);

  if (!csv.trim()) {
    return importState({
      status: "error",
      message: "Paste CSV rows before previewing the import.",
      csv
    });
  }

  const existingEntries = await prisma.entry.findMany({
    where: { campaignId },
    select: { email: true, reference: true }
  });
  const validation = validateEntriesCsv(csv, existingEntries);
  const message =
    validation.summary.validRows === 0
      ? "No rows are ready to import."
      : validation.summary.errorRows > 0
        ? `${validation.summary.validRows} rows are ready to import and ${validation.summary.errorRows} rows will be skipped.`
        : `${validation.summary.validRows} rows are ready to import.`;

  return importState({
    status: "preview",
    message,
    csv,
    summary: validation.summary,
    errors: validation.errorRows,
    previewRows: validation.validRows
  });
}

export async function confirmEntriesImportAction(_previousState: EntryImportActionState, formData: FormData): Promise<EntryImportActionState> {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const csv = String(formData.get("csv") ?? "");

  if (!csv.trim()) {
    return importState({
      status: "error",
      message: "Paste CSV rows before importing.",
      csv
    });
  }

  const existingEntries = await prisma.entry.findMany({
    where: { campaignId },
    select: { email: true, reference: true }
  });
  const validation = validateEntriesCsv(csv, existingEntries);

  if (validation.validRows.length === 0) {
    return importState({
      status: "error",
      message: "No valid rows were available to import.",
      csv,
      summary: validation.summary,
      errors: validation.errorRows,
      previewRows: validation.validRows
    });
  }

  const { campaignSlug, created } = await prisma.$transaction(async (tx) => {
    const campaign = await lockEditableCampaign(tx, campaignId);
    const entries = [];

    for (const entry of validation.validRows) {
      entries.push(
        await createEntryWithTicket({
          campaignId,
          name: entry.name,
          email: entry.email,
          reference: entry.reference,
          tx
        })
      );
    }

    await tx.auditLog.create({
      data: {
        action: "entry.import",
        entityType: "Campaign",
        entityId: campaignId,
        metadata: JSON.stringify({
          admin: admin.email,
          importedCount: entries.length,
          skippedCount: validation.summary.errorRows
        })
      }
    });

    return { campaignSlug: campaign.slug, created: entries };
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignSlug}`);

  return importState({
    status: "imported",
    message:
      validation.summary.errorRows > 0
        ? `${created.length} rows imported. ${validation.summary.errorRows} rows were skipped.`
        : `${created.length} rows imported.`,
    csv: "",
    summary: {
      totalRows: validation.summary.totalRows,
      validRows: created.length,
      errorRows: validation.summary.errorRows
    },
    errors: validation.errorRows,
    previewRows: []
  });
}

export async function runDrawAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const { draw, slug } = await prisma.$transaction(async (tx) => {
    const locked = await tx.campaign.updateMany({
      where: {
        id: campaignId,
        status: { not: "ARCHIVED" },
        draws: { none: {} }
      },
      data: {
        status: "LOCKED",
        allowPublicEntries: false
      }
    });

    if (locked.count !== 1) {
      throw new Error("This campaign already has a completed draw or is archived.");
    }

    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      include: {
        entries: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        prizes: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        draws: true
      }
    });

    if (!campaign) {
      throw new Error("Campaign not found.");
    }

    if (!canModifyCampaign(asCampaignStatus(campaign.status))) {
      throw new Error("Archived campaigns cannot be changed.");
    }

    if (campaign.draws.length > 0) {
      throw new Error("This campaign already has a completed draw.");
    }

    if (campaign.prizes.length === 0) {
      throw new Error("Add at least one prize before running a draw.");
    }

    const eligibleEntries = campaign.entries.filter(isApprovedForDraw);
    if (eligibleEntries.length === 0) {
      throw new Error("Add at least one eligible entry before running a draw.");
    }

    const manifest = createDrawEntryManifest(eligibleEntries);
    const selection = selectWinners(eligibleEntries, campaign.prizes);
    const createdDraw = await tx.draw.create({
      data: {
        campaignId,
        seed: selection.seed,
        seedHash: selection.seedHash,
        algorithmVersion: drawAlgorithmVersion,
        entryManifestHash: manifest.hash,
        entryManifestJson: manifest.json,
        winners: {
          create: selection.winners.map((winner) => ({
            entryId: winner.entryId,
            prizeId: winner.prizeId,
            rank: winner.rank
          }))
        }
      }
    });
    const bundle = buildDrawVerificationBundle({
      campaign,
      draw: {
        id: createdDraw.id,
        createdAt: createdDraw.createdAt,
        seed: createdDraw.seed,
        seedHash: createdDraw.seedHash,
        algorithmVersion: createdDraw.algorithmVersion,
        entryManifestHash: manifest.hash,
        verificationBundleHash: null
      },
      entries: manifest.entries,
      prizes: campaign.prizes,
      winners: selection.winners
    });
    const verificationBundleHash = createVerificationBundleHash(bundle);

    await tx.draw.update({
      where: { id: createdDraw.id },
      data: { verificationBundleHash }
    });

    await tx.campaign.update({
      where: { id: campaignId },
      data: { status: "DRAWN", isPublic: true, allowPublicEntries: false }
    });

    await tx.auditLog.create({
      data: {
        action: "draw.run",
        entityType: "Draw",
        entityId: createdDraw.id,
        metadata: JSON.stringify({
          admin: admin.email,
          campaignId,
          eligibleEntryCount: eligibleEntries.length,
          winnerCount: selection.winners.length,
          seedHash: selection.seedHash,
          entryManifestHash: manifest.hash,
          verificationBundleHash
        })
      }
    });

    return { draw: createdDraw, slug: campaign.slug };
  });

  revalidatePath("/");
  revalidatePath(`/campaigns/${slug}`);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  redirect(`/admin/campaigns/${campaignId}?draw=${draw.id}`);
}

export async function archiveCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, slug: true, status: true, isPublic: true }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (campaign.status === "ARCHIVED") {
    redirect(`/admin/campaigns/${campaign.id}`);
  }

  const archiveMetadata = createArchiveMetadata(asCampaignStatus(campaign.status), campaign.isPublic);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "ARCHIVED", isPublic: false }
  });

  await writeAudit("campaign.archive", "Campaign", campaign.id, {
    admin: admin.email,
    ...archiveMetadata
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath(`/admin/campaigns/${campaign.id}`);
  redirect(`/admin/campaigns/${campaign.id}`);
}

export async function restoreCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      slug: true,
      status: true,
      _count: { select: { draws: true } }
    }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (campaign.status !== "ARCHIVED") {
    redirect(`/admin/campaigns/${campaign.id}`);
  }

  const archiveLog = await prisma.auditLog.findFirst({
    where: {
      action: "campaign.archive",
      entityType: "Campaign",
      entityId: campaign.id
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true }
  });
  const restored = restoreCampaignState(campaign._count.draws, archiveLog?.metadata);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: restored.previousStatus,
      isPublic: restored.previousIsPublic
    }
  });

  await writeAudit("campaign.restore", "Campaign", campaign.id, {
    admin: admin.email,
    restoredStatus: restored.previousStatus,
    restoredIsPublic: restored.previousIsPublic
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath(`/admin/campaigns/${campaign.id}`);
  redirect(`/admin/campaigns/${campaign.id}`);
}

export async function deleteCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const confirmation = formString(formData, "confirmation");
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      _count: { select: { draws: true, entries: true, prizes: true } }
    }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (!canDeleteCampaign(asCampaignStatus(campaign.status), campaign._count.draws)) {
    throw new Error("Only draft campaigns without draws can be deleted.");
  }

  if (confirmation !== campaign.title) {
    throw new Error("Type the campaign title exactly to delete it.");
  }

  await writeAudit("campaign.delete", "Campaign", campaign.id, {
    admin: admin.email,
    title: campaign.title,
    slug: campaign.slug,
    entries: campaign._count.entries,
    prizes: campaign._count.prizes
  });

  await prisma.campaign.delete({ where: { id: campaign.id } });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirect("/admin");
}

export async function updateAppSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = appSettingsSchema.parse({
    operatorName: formString(formData, "operatorName"),
    publicTagline: formString(formData, "publicTagline"),
    supportEmail: formString(formData, "supportEmail"),
    logoUrl: formString(formData, "logoUrl"),
    brandColor: formString(formData, "brandColor")
  });

  await upsertAppSettings(parsed);
  await writeAudit("settings.update", "AppSettings", "app", { admin: admin.email });

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  redirect("/admin/settings?saved=1");
}
