"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEntriesCsv } from "@/lib/csv";
import { drawAlgorithmVersion, selectWinners } from "@/lib/draw";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { createTicketCode } from "@/lib/tickets";
import { campaignSchema, entrySchema, prizeSchema } from "@/lib/validators";

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

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = campaignSchema.parse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    rules: formString(formData, "rules"),
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    isPublic: formData.get("isPublic") === "on"
  });

  const baseSlug = slugify(parsed.title) || `campaign-${Date.now()}`;
  const campaign = await prisma.campaign.create({
    data: {
      title: parsed.title,
      slug: baseSlug,
      description: parsed.description,
      rules: parsed.rules,
      startsAt: optionalDate(parsed.startsAt),
      endsAt: optionalDate(parsed.endsAt),
      isPublic: parsed.isPublic,
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
        startsAt: optionalDate(parsed.startsAt),
        endsAt: optionalDate(parsed.endsAt),
        isPublic: parsed.isPublic,
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
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    isPublic: formData.get("isPublic") === "on"
  });

  const existing = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      title: parsed.title,
      description: parsed.description,
      rules: parsed.rules,
      startsAt: optionalDate(parsed.startsAt),
      endsAt: optionalDate(parsed.endsAt),
      isPublic: existing.status === "DRAWN" ? true : parsed.isPublic,
      status: existing.status === "DRAWN" ? "DRAWN" : parsed.isPublic ? "OPEN" : "DRAFT"
    }
  });

  await writeAudit("campaign.update", "Campaign", campaignId, { admin: admin.email });
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

  const prize = await prisma.prize.create({
    data: {
      campaignId,
      name: parsed.name,
      description: parsed.description || null,
      quantity: parsed.quantity,
      sortOrder: parsed.sortOrder
    }
  });

  await writeAudit("prize.create", "Prize", prize.id, { admin: admin.email, campaignId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function addEntryAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const parsed = entrySchema.parse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    reference: formString(formData, "reference") || undefined
  });

  const entry = await prisma.entry.create({
    data: {
      campaignId,
      name: parsed.name,
      email: parsed.email,
      reference: parsed.reference,
      ticketCode: createTicketCode()
    }
  });

  await writeAudit("entry.create", "Entry", entry.id, { admin: admin.email, campaignId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function importEntriesAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const csv = String(formData.get("csv") ?? "");
  const parsedEntries = parseEntriesCsv(csv);
  const seenEmails = new Set<string>();
  const seenReferences = new Set<string>();

  for (const entry of parsedEntries) {
    if (seenEmails.has(entry.email)) {
      throw new Error(`Duplicate email in CSV: ${entry.email}`);
    }
    seenEmails.add(entry.email);

    if (entry.reference) {
      if (seenReferences.has(entry.reference)) {
        throw new Error(`Duplicate reference in CSV: ${entry.reference}`);
      }
      seenReferences.add(entry.reference);
    }
  }

  const created = await prisma.$transaction(
    parsedEntries.map((entry) =>
      prisma.entry.create({
        data: {
          campaignId,
          name: entry.name,
          email: entry.email,
          reference: entry.reference,
          ticketCode: createTicketCode()
        }
      })
    )
  );

  await writeAudit("entry.import", "Campaign", campaignId, { admin: admin.email, count: created.length });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function runDrawAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = formString(formData, "campaignId");
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      entries: true,
      prizes: true,
      draws: true
    }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (campaign.draws.length > 0) {
    throw new Error("This campaign already has a completed draw.");
  }

  if (campaign.prizes.length === 0) {
    throw new Error("Add at least one prize before running a draw.");
  }

  const eligibleEntries = campaign.entries.filter((entry) => entry.isEligible);
  if (eligibleEntries.length === 0) {
    throw new Error("Add at least one eligible entry before running a draw.");
  }

  const selection = selectWinners(eligibleEntries, campaign.prizes);

  const draw = await prisma.$transaction(async (tx) => {
    const createdDraw = await tx.draw.create({
      data: {
        campaignId,
        seed: selection.seed,
        seedHash: selection.seedHash,
        algorithmVersion: drawAlgorithmVersion,
        winners: {
          create: selection.winners.map((winner) => ({
            entryId: winner.entryId,
            prizeId: winner.prizeId,
            rank: winner.rank
          }))
        }
      }
    });

    await tx.campaign.update({
      where: { id: campaignId },
      data: { status: "DRAWN", isPublic: true }
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
          seedHash: selection.seedHash
        })
      }
    });

    return createdDraw;
  });

  revalidatePath("/");
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  redirect(`/admin/campaigns/${campaignId}?draw=${draw.id}`);
}
