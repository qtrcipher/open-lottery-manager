import Link from "next/link";
import { ArrowLeft, Hash, ShieldCheck, Ticket, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { OperatorBrand } from "@/components/brand";
import { PageShell, Panel, StatusBadge } from "@/components/ui";
import { createDrawVerificationSummary } from "@/lib/draw-verification";
import { getAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function DrawVerificationPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const [settings, campaign] = await Promise.all([
    getAppSettings(),
    prisma.campaign.findFirst({
      where: { slug: resolvedParams.slug, isPublic: true, status: { not: "ARCHIVED" } },
      include: {
        entries: { select: { isEligible: true } },
        draws: {
          orderBy: { createdAt: "desc" },
          include: {
            winners: {
              orderBy: { rank: "asc" },
              include: { entry: true, prize: true }
            }
          }
        }
      }
    })
  ]);

  if (!campaign) {
    notFound();
  }

  const draw = campaign.draws[0];
  if (!draw) {
    notFound();
  }

  const summary = createDrawVerificationSummary(campaign.entries, draw.winners);

  return (
    <PageShell>
      <header className="flex flex-col gap-5 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-5">
            <OperatorBrand settings={settings} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge>{campaign.status}</StatusBadge>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/72 px-3 py-1 text-xs font-semibold text-ink/70">
              <ShieldCheck size={14} aria-hidden="true" />
              Published draw record
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight">{campaign.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">
            Review the published draw record for this campaign, including the seed hash, algorithm version, entry counts, and ordered winners.
          </p>
        </div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper" href={`/campaigns/${campaign.slug}`}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back to campaign
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <Hash size={20} aria-hidden="true" />
            <h2 className="text-xl font-semibold">Draw record</h2>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <dt className="text-ink/64">Draw completed</dt>
              <dd className="font-semibold">{formatDateTime(draw.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-ink/64">Seed hash</dt>
              <dd className="mt-1 break-all font-mono text-xs">{draw.seedHash}</dd>
            </div>
            <div>
              <dt className="text-ink/64">Algorithm version</dt>
              <dd className="mt-1 break-all font-mono text-xs">{draw.algorithmVersion}</dd>
            </div>
          </dl>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <Ticket size={20} aria-hidden="true" />
            <h2 className="text-xl font-semibold">Draw summary</h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/64">Total entries</dt>
              <dd className="mt-1 text-2xl font-bold">{summary.totalEntryCount}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/64">Eligible entries</dt>
              <dd className="mt-1 text-2xl font-bold">{summary.eligibleEntryCount}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/64">Winners</dt>
              <dd className="mt-1 text-2xl font-bold">{summary.winnerCount}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/64">Status</dt>
              <dd className="mt-2">
                <StatusBadge>{draw.status}</StatusBadge>
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel className="mt-5">
        <div className="flex items-center gap-2">
          <Trophy size={20} aria-hidden="true" />
          <h2 className="text-xl font-semibold">Ordered winners</h2>
        </div>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.winners.map((winner) => (
            <li key={`${winner.rank}-${winner.ticketCode}`} className="rounded-md border border-line bg-paper/70 p-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">#{winner.rank} {winner.participantName}</span>
                <span className="brand-text text-sm">{winner.prizeName}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-ink/58">{winner.ticketCode}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="mt-5">
        <h2 className="text-xl font-semibold">Record note</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          This page exposes recorded draw data for participant inspection. It is not an independent recomputation of the draw and does not replace
          licensing, regulatory review, independent auditing, legal disclosures, or operator recordkeeping obligations.
        </p>
      </Panel>
    </PageShell>
  );
}
