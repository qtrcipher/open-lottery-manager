import {
  auditExportWhere,
  entryExportWhere,
  filterCampaignContexts,
  parseGlobalExportFilters,
  type GlobalExportFilters,
  winnerExportWhere
} from "@/lib/export-filters";
import {
  filterAuditLogsByCampaignContext,
  globalAuditHeaders,
  globalAuditRows,
  globalEntryHeaders,
  globalEntryRows,
  globalWinnerHeaders,
  globalWinnerRows
} from "@/lib/export-rows";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { serializeCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type GlobalExportKind = "entries" | "winners" | "audit";

const exportKinds = new Set<string>(["entries", "winners", "audit"]);

function isGlobalExportKind(value: string): value is GlobalExportKind {
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

async function exportEntries(filters: GlobalExportFilters): Promise<Response> {
  const entries = await prisma.entry.findMany({
    where: entryExportWhere(filters),
    orderBy: { createdAt: "asc" },
    include: {
      campaign: {
        select: { id: true, title: true, slug: true, status: true }
      }
    }
  });

  return csvResponse("all-entries.csv", serializeCsv(globalEntryHeaders, globalEntryRows(entries)));
}

async function exportWinners(filters: GlobalExportFilters): Promise<Response> {
  const winners = await prisma.drawWinner.findMany({
    where: winnerExportWhere(filters),
    orderBy: [{ createdAt: "asc" }, { rank: "asc" }],
    include: {
      prize: {
        select: { name: true }
      },
      entry: {
        select: { ticketCode: true, name: true, email: true, reference: true }
      },
      draw: {
        select: {
          seedHash: true,
          algorithmVersion: true,
          createdAt: true,
          campaign: {
            select: { id: true, title: true, slug: true, status: true }
          }
        }
      }
    }
  });

  return csvResponse("all-winners.csv", serializeCsv(globalWinnerHeaders, globalWinnerRows(winners)));
}

async function exportAudit(filters: GlobalExportFilters): Promise<Response> {
  const [campaigns, logs] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, slug: true, status: true }
    }),
    prisma.auditLog.findMany({
      where: auditExportWhere(filters),
      orderBy: { createdAt: "asc" }
    })
  ]);

  const filteredCampaigns = filterCampaignContexts(campaigns, filters);
  const filteredLogs = filters.campaignId || filters.status ? filterAuditLogsByCampaignContext(logs, filteredCampaigns) : logs;

  return csvResponse("all-audit.csv", serializeCsv(globalAuditHeaders, globalAuditRows(filteredLogs, filteredCampaigns)));
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  await requireAdmin();
  const { kind } = await params;
  const filters = parseGlobalExportFilters(new URL(request.url).searchParams);

  if (!isGlobalExportKind(kind)) {
    return notFound("Unknown export type.");
  }

  if (kind === "entries") {
    return exportEntries(filters);
  }

  if (kind === "winners") {
    return exportWinners(filters);
  }

  return exportAudit(filters);
}
