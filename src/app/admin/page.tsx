import { PlusCircle } from "lucide-react";
import { restoreCampaignAction } from "@/app/admin/actions";
import { ButtonLink, PageShell, Panel, StatusBadge, SubmitButton } from "@/components/ui";
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
  const activeCampaigns = campaigns.filter((campaign) => campaign.status !== "ARCHIVED");
  const archivedCampaigns = campaigns.filter((campaign) => campaign.status === "ARCHIVED");

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

      {activeCampaigns.length === 0 ? (
        <Panel>
          <p className="text-sm text-ink/68">
            {campaigns.length === 0 ? "No campaigns yet. Create the first campaign to begin." : "No active campaigns. Restore an archived campaign or create a new one."}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {activeCampaigns.map((campaign) => (
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

      {archivedCampaigns.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Archived campaigns</h2>
          <div className="mt-4 grid gap-4">
            {archivedCampaigns.map((campaign) => (
              <Panel key={campaign.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <StatusBadge>{campaign.status}</StatusBadge>
                    <h3 className="mt-3 text-xl font-semibold">{campaign.title}</h3>
                    <p className="mt-2 text-sm text-ink/68">{campaign.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ButtonLink href={`/admin/campaigns/${campaign.id}`}>Manage</ButtonLink>
                    <form action={restoreCampaignAction}>
                      <input name="campaignId" type="hidden" value={campaign.id} />
                      <SubmitButton>Restore</SubmitButton>
                    </form>
                  </div>
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
        </section>
      ) : null}
    </PageShell>
  );
}
