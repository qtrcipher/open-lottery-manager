import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, Panel, StatusBadge } from "@/components/ui";
import { createDrawVerificationSummary } from "@/lib/draw-verification";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DrawVerificationPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const campaign = await prisma.campaign.findFirst({
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
  });

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
      <header className="flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusBadge>{campaign.status}</StatusBadge>
          <h1 className="mt-4 text-4xl font-bold">{campaign.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">
            Review the recorded draw data for this campaign, including the seed hash, algorithm version, entry counts, and ordered winners.
          </p>
        </div>
        <Link className="font-semibold text-moss" href={`/campaigns/${campaign.slug}`}>
          Back to campaign
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Panel>
          <h2 className="text-xl font-semibold">Draw record</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <dt className="text-ink/64">Draw completed</dt>
              <dd className="font-semibold">{draw.createdAt.toLocaleString()}</dd>
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
          <h2 className="text-xl font-semibold">Verification summary</h2>
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
        <h2 className="text-xl font-semibold">Ordered winners</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.winners.map((winner) => (
            <li key={`${winner.rank}-${winner.ticketCode}`} className="rounded-md border border-line bg-paper/70 p-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">#{winner.rank} {winner.participantName}</span>
                <span className="text-sm text-moss">{winner.prizeName}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-ink/58">{winner.ticketCode}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="mt-5">
        <h2 className="text-xl font-semibold">Verification note</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          This page exposes recorded draw data for participant inspection. It does not replace licensing, regulatory review, independent auditing,
          legal disclosures, or operator recordkeeping obligations.
        </p>
      </Panel>
    </PageShell>
  );
}
