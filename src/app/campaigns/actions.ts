"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAcceptPublicEntries, type CampaignStatusValue } from "@/lib/campaign-lifecycle";
import { prisma } from "@/lib/prisma";
import { createTicketCode } from "@/lib/tickets";
import { publicEntrySchema } from "@/lib/validators";

function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function redirectToCampaign(slug: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`/campaigns/${slug}?${searchParams.toString()}`);
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

async function createEntryWithTicket({
  campaignId,
  name,
  email,
  reference
}: {
  campaignId: string;
  name: string;
  email: string;
  reference?: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.entry.create({
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
      slug: true,
      status: true,
      isPublic: true,
      allowPublicEntries: true,
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

  let entry;
  try {
    entry = await createEntryWithTicket({
      campaignId: campaign.id,
      name: parsed.data.name,
      email: parsed.data.email,
      reference: parsed.data.reference
    });
  } catch (error) {
    if (isUniqueError(error)) {
      redirectToCampaign(campaign.slug, { entry: uniqueFailureCode(error) });
    }

    throw error;
  }

  await prisma.auditLog.create({
    data: {
      action: "entry.public_create",
      entityType: "Entry",
      entityId: entry.id,
      metadata: JSON.stringify({ campaignId: campaign.id })
    }
  });

  revalidatePath("/");
  revalidatePath(`/campaigns/${campaign.slug}`);
  redirectToCampaign(campaign.slug, { ticket: entry.ticketCode });
}
