import { PlusCircle } from "lucide-react";
import { restoreCampaignAction } from "@/app/admin/actions";
import { ButtonLink, PageShell, Panel, StatusBadge, SubmitButton } from "@/components/ui";
import { checkDatabaseHealth, createHealthPayload } from "@/lib/health";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();

  const [campaigns, databaseStatus] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { entries: true, prizes: true, draws: true } }
      }
    }),
    checkDatabaseHealth()
  ]);
  const health = createHealthPayload({ databaseStatus });
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

      <Panel className="mb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">System status</h2>
            <p className="mt-2 text-sm leading-6 text-ink/68">Runtime details for this admin session and deployment.</p>
          </div>
          <StatusBadge>{health.status}</StatusBadge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Version</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">{health.version}</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Database</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">{health.database.status}</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Uptime</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">{health.uptime.display}</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Public URL</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">{health.publicUrl ?? "Not configured"}</dd>
          </div>
        </dl>
      </Panel>

      <Panel className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Operations</h2>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              Run backup, restore, and smoke-test commands on the host server. The browser dashboard does not execute production maintenance tasks.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
            href="https://github.com/qtrcipher/open-lottery-manager/blob/main/DEPLOYMENT.md"
            rel="noreferrer"
            target="_blank"
          >
            Deployment guide
          </a>
        </div>
        <dl className="mt-4 grid gap-3 text-sm lg:grid-cols-3">
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Backup</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">npm run backup</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Restore</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">npm run restore -- backups/prod-YYYYMMDD-HHMMSS.db --confirm</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="font-semibold">Smoke test</dt>
            <dd className="mt-2 break-all font-mono text-xs text-ink/70">npm run smoke:deploy -- http://localhost:3000</dd>
          </div>
        </dl>
      </Panel>

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
