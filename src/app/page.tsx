import { CalendarDays, ShieldCheck, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ButtonLink, PageShell, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const campaigns = await prisma.campaign.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { entries: true, prizes: true }
      }
    }
  });

  return (
    <PageShell>
      <header className="flex flex-col gap-6 py-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1 text-sm font-semibold text-moss">
            <ShieldCheck size={16} aria-hidden="true" />
            Open-source draw operations
          </div>
          <h1 className="text-4xl font-bold tracking-normal text-ink sm:text-5xl">Open Lottery Manager</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/72">
            Self-hosted campaign management for lawful prize draws, raffles, promotional giveaways, and licensed lottery-style operations.
          </p>
        </div>
        <ButtonLink href="/admin/login">Admin login</ButtonLink>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Platform highlights">
        <Panel>
          <Ticket className="mb-3 text-gold" size={28} aria-hidden="true" />
          <h2 className="text-lg font-semibold">Entry control</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Import or create entries and keep participant records attached to each campaign.</p>
        </Panel>
        <Panel>
          <CalendarDays className="mb-3 text-moss" size={28} aria-hidden="true" />
          <h2 className="text-lg font-semibold">Public campaigns</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Publish campaign rules, prize details, dates, and final results for participants.</p>
        </Panel>
        <Panel>
          <ShieldCheck className="mb-3 text-brick" size={28} aria-hidden="true" />
          <h2 className="text-lg font-semibold">Auditable draws</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Each draw records a seed hash, algorithm version, timestamp, and winner list.</p>
        </Panel>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Public campaigns</h2>
        </div>
        {campaigns.length === 0 ? (
          <Panel>
            <p className="text-sm text-ink/70">No public campaigns are available yet.</p>
          </Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((campaign) => (
              <Panel key={campaign.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StatusBadge>{campaign.status}</StatusBadge>
                    <h3 className="mt-3 text-xl font-semibold">{campaign.title}</h3>
                  </div>
                  <ButtonLink href={`/campaigns/${campaign.slug}`} className="bg-moss hover:bg-ink">
                    View
                  </ButtonLink>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/70">{campaign.description}</p>
                <dl className="mt-4 flex gap-5 text-sm text-ink/64">
                  <div>
                    <dt className="font-semibold text-ink">Entries</dt>
                    <dd>{campaign._count.entries}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Prizes</dt>
                    <dd>{campaign._count.prizes}</dd>
                  </div>
                </dl>
              </Panel>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
