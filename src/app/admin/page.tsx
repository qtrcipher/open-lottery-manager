import Link from "next/link";
import type { ReactNode } from "react";
import { Download, PlusCircle } from "lucide-react";
import { restoreCampaignAction } from "@/app/admin/actions";
import { ButtonLink, Label, PageShell, Panel, StatusBadge, SubmitButton, TextInput } from "@/components/ui";
import { recentActivityItems } from "@/lib/audit-activity";
import { campaignStatusOptions, globalExportHref, parseGlobalExportFilters } from "@/lib/export-filters";
import { checkDatabaseHealth, createHealthPayload } from "@/lib/health";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

function ExportLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
      href={href}
    >
      <Download aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}

export default async function AdminDashboard({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const exportFilters = parseGlobalExportFilters(resolvedSearchParams);

  const [campaigns, databaseStatus, activityLogs] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { entries: true, prizes: true, draws: true } }
      }
    }),
    checkDatabaseHealth(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);
  const health = createHealthPayload({ databaseStatus });
  const recentActivity = recentActivityItems(activityLogs, campaigns);
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
        <div className="mt-4 rounded-md border border-line bg-paper/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold">Backup readiness</h3>
              <p className="mt-2 text-sm leading-6 text-ink/68">
                Confirm a current SQLite backup before draws, restores, and version upgrades. Keep backup files on the host server, not in the browser.
              </p>
            </div>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
              href="https://github.com/qtrcipher/open-lottery-manager/blob/main/DEPLOYMENT.md#backup-and-restore"
              rel="noreferrer"
              target="_blank"
            >
              Backup docs
            </a>
          </div>
          <ul className="mt-3 grid gap-2 text-sm text-ink/70 lg:grid-cols-3">
            <li className="rounded-md border border-line bg-white px-3 py-2">Run `npm run backup` on the host server.</li>
            <li className="rounded-md border border-line bg-white px-3 py-2">Store `backups/prod-YYYYMMDD-HHMMSS.db` outside the app container.</li>
            <li className="rounded-md border border-line bg-white px-3 py-2">Test restore steps on a copy before relying on production backups.</li>
          </ul>
        </div>
        <form action="/admin" className="mt-4 grid gap-3 rounded-md border border-line bg-paper/70 p-3 text-sm lg:grid-cols-5" method="get">
          <div>
            <Label>Campaign</Label>
            <select
              className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
              defaultValue={exportFilters.campaignId}
              name="campaignId"
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm" defaultValue={exportFilters.status} name="status">
              <option value="">All statuses</option>
              {campaignStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>From</Label>
            <TextInput defaultValue={exportFilters.fromInput} name="from" type="datetime-local" />
          </div>
          <div>
            <Label>To</Label>
            <TextInput defaultValue={exportFilters.toInput} name="to" type="datetime-local" />
          </div>
          <div className="flex items-end gap-2">
            <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss" type="submit">
              Apply
            </button>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
              href="/admin"
            >
              Reset
            </Link>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-3">
          <ExportLink href={globalExportHref("entries", exportFilters)}>All entries CSV</ExportLink>
          <ExportLink href={globalExportHref("winners", exportFilters)}>All winners CSV</ExportLink>
          <ExportLink href={globalExportHref("audit", exportFilters)}>All audit CSV</ExportLink>
        </div>
      </Panel>

      <Panel className="mb-5">
        <div>
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <p className="mt-2 text-sm leading-6 text-ink/68">Latest admin, campaign, entry, prize, import, draw, and settings events.</p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-4 rounded-md border border-line bg-paper/70 p-4 text-sm text-ink/68">No audit activity has been recorded yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-line rounded-md border border-line bg-paper/70">
            {recentActivity.map((activity) => (
              <div key={`${activity.action}-${activity.entityId}-${activity.createdAt.toISOString()}`} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{activity.action}</p>
                  <p className="mt-1 text-xs text-ink/62">
                    {activity.entityType} <span className="font-mono">{activity.entityId}</span>
                    {activity.campaign ? " · " : ""}
                    {activity.campaign ? (
                      <Link className="font-semibold text-moss hover:underline" href={`/admin/campaigns/${activity.campaign.id}`}>
                        {activity.campaign.title}
                      </Link>
                    ) : null}
                  </p>
                </div>
                <time className="text-xs text-ink/62" dateTime={activity.createdAt.toISOString()}>
                  {activity.createdAt.toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        )}
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
