import { notFound } from "next/navigation";
import { OperatorBrand } from "@/components/brand";
import { ButtonLink, PageShell, Panel, StatusBadge } from "@/components/ui";
import { getAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const [settings, campaign] = await Promise.all([
    getAppSettings(),
    prisma.campaign.findFirst({
      where: { slug: resolvedParams.slug, isPublic: true, status: { not: "ARCHIVED" } },
      include: {
        prizes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        draws: {
          orderBy: { createdAt: "desc" },
          include: {
            winners: {
              orderBy: { rank: "asc" },
              include: { entry: true, prize: true }
            }
          }
        },
        _count: { select: { entries: true } }
      }
    })
  ]);

  if (!campaign) {
    notFound();
  }

  const draw = campaign.draws[0];

  return (
    <PageShell>
      <header className="py-8">
        <div className="mb-5">
          <OperatorBrand settings={settings} />
        </div>
        <StatusBadge>{campaign.status}</StatusBadge>
        <h1 className="mt-4 text-4xl font-bold">{campaign.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">{campaign.description}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Panel>
          <h2 className="text-xl font-semibold">Campaign rules</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/74">{campaign.rules}</p>
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Campaign details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink/64">Entries</dt>
              <dd className="font-semibold">{campaign._count.entries}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/64">Start</dt>
              <dd className="font-semibold">{campaign.startsAt ? campaign.startsAt.toLocaleString() : "Not set"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/64">End</dt>
              <dd className="font-semibold">{campaign.endsAt ? campaign.endsAt.toLocaleString() : "Not set"}</dd>
            </div>
            {settings.supportEmail ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink/64">Support</dt>
                <dd className="font-semibold">
                  <a className="brand-text" href={`mailto:${settings.supportEmail}`}>
                    Email operator
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold">Prizes</h2>
          <div className="mt-4 space-y-3">
            {campaign.prizes.length === 0 ? (
              <p className="text-sm text-ink/68">No prizes have been published yet.</p>
            ) : (
              campaign.prizes.map((prize) => (
                <div key={prize.id} className="rounded-md border border-line bg-paper/70 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">{prize.name}</h3>
                    <span className="text-sm text-ink/64">x{prize.quantity}</span>
                  </div>
                  {prize.description ? <p className="mt-1 text-sm text-ink/68">{prize.description}</p> : null}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Draw results</h2>
          {!draw ? (
            <p className="mt-4 text-sm text-ink/68">Results will appear here after the operator completes the draw.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <dl className="rounded-md border border-line bg-paper/70 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/64">Completed</dt>
                  <dd className="font-semibold">{draw.createdAt.toLocaleString()}</dd>
                </div>
                <div className="mt-2 break-all">
                  <dt className="text-ink/64">Seed hash</dt>
                  <dd className="font-mono text-xs">{draw.seedHash}</dd>
                </div>
                <div className="mt-2">
                  <dt className="text-ink/64">Algorithm</dt>
                  <dd className="font-mono text-xs">{draw.algorithmVersion}</dd>
                </div>
              </dl>
              <ol className="space-y-2">
                {draw.winners.map((winner) => (
                  <li key={winner.id} className="rounded-md border border-line bg-white p-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold">#{winner.rank} {winner.entry.name}</span>
                      <span className="brand-text text-sm">{winner.prize.name}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-ink/58">{winner.entry.ticketCode}</p>
                  </li>
                ))}
              </ol>
              <ButtonLink href={`/campaigns/${campaign.slug}/verify`} className="brand-bg">
                View draw record
              </ButtonLink>
            </div>
          )}
        </Panel>
      </section>
    </PageShell>
  );
}
