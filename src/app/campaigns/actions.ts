"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAcceptPublicEntries, type CampaignStatusValue } from "@/lib/campaign-lifecycle";
import { getAppSettings } from "@/lib/app-settings";
import { sendTicketReceipt } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, isHoneypotFilled, rateLimitSubjectFromHeaders } from "@/lib/rate-limit";
import { createTicketCode } from "@/lib/tickets";
import { publicEntrySchema, ticketLookupSchema } from "@/lib/validators";

const publicEntryRateLimit = { limit: 5, windowSeconds: 10 * 60 };
const ticketLookupRateLimit = { limit: 10, windowSeconds: 10 * 60 };

function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function redirectToCampaign(slug: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`/campaigns/${slug}?${searchParams.toString()}`);
}

function redirectToLookup(slug: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`/campaigns/${slug}/lookup?${searchParams.toString()}`);
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

function publicBaseUrl(requestHeaders: Headers): string {
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  const host = trustProxyHeaders ? requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") : requestHeaders.get("host");
  const protocol = trustProxyHeaders ? requestHeaders.get("x-forwarded-proto") || "https" : process.env.NODE_ENV === "production" ? "https" : "http";

  return `${protocol}://${host ?? "localhost:3000"}`;
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

export async function createPublicEntryAction(formData: FormData) {
  const slug = formString(formData, "slug");
  if (!slug) {
    redirect("/");
  }

  if (isHoneypotFilled(formData)) {
    redirectToCampaign(slug, { entry: "invalid" });
  }

  const requestHeaders = await headers();
  const entryRateLimit = await checkRateLimit({
    action: "public_entry",
    subject: `${slug}:${rateLimitSubjectFromHeaders(requestHeaders)}`,
    ...publicEntryRateLimit
  });

  if (!entryRateLimit.allowed) {
    redirectToCampaign(slug, { entry: "rate-limited" });
  }

  const parsed = publicEntrySchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    reference: formString(formData, "reference") || undefined
  });

  if (!parsed.success) {
    redirectToCampaign(slug, { entry: "invalid" });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      isPublic: true,
      allowPublicEntries: true,
      requireLookupReference: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { draws: true } }
    }
  });

  if (!campaign) {
    redirect("/");
  }

  if (
    !canAcceptPublicEntries({
      status: campaign.status as CampaignStatusValue,
      isPublic: campaign.isPublic,
      allowPublicEntries: campaign.allowPublicEntries,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      drawCount: campaign._count.draws
    })
  ) {
    redirectToCampaign(campaign.slug, { entry: "closed" });
  }

  if (campaign.requireLookupReference && !parsed.data.reference) {
    redirectToCampaign(campaign.slug, { entry: "invalid" });
  }

  let entry;
  try {
    entry = await prisma.$transaction(async (tx) => {
      const locked = await tx.campaign.updateMany({
        where: {
          id: campaign.id,
          status: "OPEN",
          isPublic: true,
          allowPublicEntries: true,
          draws: { none: {} }
        },
        data: { updatedAt: new Date() }
      });

      if (locked.count !== 1) {
        throw new Error("public-entry-closed");
      }

      const currentCampaign = await tx.campaign.findUniqueOrThrow({
        where: { id: campaign.id },
        select: {
          id: true,
          status: true,
          isPublic: true,
          allowPublicEntries: true,
          startsAt: true,
          endsAt: true,
          _count: { select: { draws: true } }
        }
      });

      if (
        !canAcceptPublicEntries({
          status: currentCampaign.status as CampaignStatusValue,
          isPublic: currentCampaign.isPublic,
          allowPublicEntries: currentCampaign.allowPublicEntries,
          startsAt: currentCampaign.startsAt,
          endsAt: currentCampaign.endsAt,
          drawCount: currentCampaign._count.draws
        })
      ) {
        throw new Error("public-entry-closed");
      }

      const entry = await createEntryWithTicket({
        campaignId: campaign.id,
        name: parsed.data.name,
        email: parsed.data.email,
        reference: parsed.data.reference,
        tx
      });

      await tx.auditLog.create({
        data: {
          action: "entry.public_create",
          entityType: "Entry",
          entityId: entry.id,
          metadata: JSON.stringify({ campaignId: campaign.id })
        }
      });

      return entry;
    });
  } catch (error) {
    if (isUniqueError(error)) {
      redirectToCampaign(campaign.slug, { entry: uniqueFailureCode(error) });
    }

    if (error instanceof Error && error.message === "public-entry-closed") {
      redirectToCampaign(campaign.slug, { entry: "closed" });
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/campaigns/${campaign.slug}`);
  const settings = await getAppSettings();
  const receipt = await sendTicketReceipt({
    to: entry.email,
    participantName: entry.name,
    campaignTitle: campaign.title,
    ticketCode: entry.ticketCode,
    lookupUrl: `${publicBaseUrl(requestHeaders)}/campaigns/${campaign.slug}/lookup`,
    supportEmail: settings.supportEmail
  });

  if (receipt.attempted && !receipt.sent) {
    await prisma.auditLog.create({
      data: {
        action: "email.ticket_receipt_failed",
        entityType: "Entry",
        entityId: entry.id,
        metadata: JSON.stringify({
          campaignId: campaign.id,
          error: receipt.error
        })
      }
    });
  }

  redirectToCampaign(campaign.slug, { ticket: entry.ticketCode });
}

export async function lookupTicketAction(formData: FormData) {
  const slug = formString(formData, "slug");
  if (!slug) {
    redirect("/");
  }

  if (isHoneypotFilled(formData)) {
    redirectToLookup(slug, { status: "not-found" });
  }

  const requestHeaders = await headers();
  const lookupRateLimit = await checkRateLimit({
    action: "ticket_lookup",
    subject: `${slug}:${rateLimitSubjectFromHeaders(requestHeaders)}`,
    ...ticketLookupRateLimit
  });

  if (!lookupRateLimit.allowed) {
    redirectToLookup(slug, { status: "rate-limited" });
  }

  const parsed = ticketLookupSchema.safeParse({
    email: formString(formData, "email"),
    reference: formString(formData, "reference") || undefined
  });

  if (!parsed.success) {
    redirectToLookup(slug, { status: "not-found" });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { slug, isPublic: true, status: { not: "ARCHIVED" } },
    select: { id: true, slug: true, requireLookupReference: true }
  });

  if (!campaign) {
    redirectToLookup(slug, { status: "not-found" });
  }

  if (campaign.requireLookupReference && !parsed.data.reference) {
    redirectToLookup(campaign.slug, { status: "not-found" });
  }

  const entry = await prisma.entry.findFirst({
    where: {
      campaignId: campaign.id,
      email: parsed.data.email,
      ...(parsed.data.reference ? { reference: parsed.data.reference } : {})
    },
    select: { ticketCode: true }
  });

  if (!entry) {
    redirectToLookup(campaign.slug, { status: "not-found" });
  }

  redirectToLookup(campaign.slug, { status: "found", ticket: entry.ticketCode });
}
