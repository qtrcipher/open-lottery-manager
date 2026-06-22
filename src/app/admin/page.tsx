import { PlusCircle } from "lucide-react";
import { ButtonLink, PageShell, Panel, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { entries: true, prizes: true, draws: true } }
    }
  });

  return (
    <PageShell>
      <header className="flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="mt-2 text-sm text-ink/68">Create campaigns, import entries, define prizes, and run auditable draws.</p>
        </div>
        <ButtonLink href="/admin/campaigns/new" className="gap-2">
          <PlusCircle size={18} aria-hidden="true" />
          New campaign
        </ButtonLink>
      </header>

      {campaigns.length === 0 ? (
        <Panel>
          <p className="text-sm text-ink/68">No campaigns yet. Create the first campaign to begin.</p>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Panel key={campaign.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <StatusBadge>{campaign.status}</StatusBadge>
                  <h2 className="mt-3 text-xl font-semibold">{campaign.title}</h2>
                  <p className="mt-2 text-sm text-ink/68">{campaign.description}</p>
                </div>
                <ButtonLink href={`/admin/campaigns/${campaign.id}`}>Manage</ButtonLink>
              </div>
              <dl className="mt-4 flex flex-wrap gap-5 text-sm">
                <div>
                  <dt className="font-semibold">Entries</dt>
                  <dd className="text-ink/64">{campaign._count.entries}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Prizes</dt>
                  <dd className="text-ink/64">{campaign._count.prizes}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Draws</dt>
                  <dd className="text-ink/64">{campaign._count.draws}</dd>
                </div>
              </dl>
            </Panel>
          ))}
        </div>
      )}
    </PageShell>
  );
}
