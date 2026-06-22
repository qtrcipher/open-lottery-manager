import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { serializeCsv, type CsvRow } from "@/lib/csv";

export const dynamic = "force-dynamic";

type ExportKind = "entries" | "winners" | "audit";

const exportKinds = new Set<string>(["entries", "winners", "audit"]);

function isExportKind(value: string): value is ExportKind {
  return exportKinds.has(value);
}

function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

function notFound(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

async function exportEntries(campaignId: string, slug: string): Promise<Response> {
  const entries = await prisma.entry.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" }
  });
  const headers = ["ticketCode", "name", "email", "reference", "isEligible", "createdAt"];
  const rows: CsvRow[] = entries.map((entry) => ({
    ticketCode: entry.ticketCode,
    name: entry.name,
    email: entry.email,
    reference: entry.reference,
    isEligible: entry.isEligible,
    createdAt: entry.createdAt
  }));

  return csvResponse(`${slug}-entries.csv`, serializeCsv(headers, rows));
}

async function exportWinners(campaignId: string, slug: string): Promise<Response> {
  const draw = await prisma.draw.findFirst({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      winners: {
        orderBy: { rank: "asc" },
        include: { entry: true, prize: true }
      }
    }
  });

  if (!draw) {
    return notFound("No completed draw exists for this campaign.");
  }

  const headers = [
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
  const rows: CsvRow[] = draw.winners.map((winner) => ({
    rank: winner.rank,
    prizeName: winner.prize.name,
    ticketCode: winner.entry.ticketCode,
    name: winner.entry.name,
    email: winner.entry.email,
    reference: winner.entry.reference,
    drawSeedHash: draw.seedHash,
    algorithmVersion: draw.algorithmVersion,
    drawnAt: draw.createdAt
  }));

  return csvResponse(`${slug}-winners.csv`, serializeCsv(headers, rows));
}

async function exportAudit(campaignId: string, slug: string): Promise<Response> {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "Campaign", entityId: campaignId },
        { metadata: { contains: campaignId } }
      ]
    },
    orderBy: { createdAt: "asc" }
  });
  const headers = ["action", "entityType", "entityId", "metadata", "createdAt"];
  const rows: CsvRow[] = logs.map((log) => ({
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: log.metadata,
    createdAt: log.createdAt
  }));

  return csvResponse(`${slug}-audit.csv`, serializeCsv(headers, rows));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  await requireAdmin();
  const { id, kind } = await params;

  if (!isExportKind(kind)) {
    return notFound("Unknown export type.");
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, slug: true }
  });

  if (!campaign) {
    return notFound("Campaign not found.");
  }

  if (kind === "entries") {
    return exportEntries(campaign.id, campaign.slug);
  }

  if (kind === "winners") {
    return exportWinners(campaign.id, campaign.slug);
  }

  return exportAudit(campaign.id, campaign.slug);
}
