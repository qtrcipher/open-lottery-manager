import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import {
  addEntryAction,
  addPrizeAction,
  archiveCampaignAction,
  deleteCampaignAction,
  importEntriesAction,
  restoreCampaignAction,
  runDrawAction,
  updateCampaignAction
} from "@/app/admin/actions";
import { Label, PageShell, Panel, StatusBadge, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { canDeleteCampaign, canEditCampaignSetup } from "@/lib/campaign-lifecycle";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatDateInput(date: Date | null): string {
  if (!date) {
    return "";
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

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

export default async function CampaignAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const resolvedParams = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: resolvedParams.id },
    include: {
      prizes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      entries: { orderBy: { createdAt: "desc" }, take: 10 },
      draws: {
        orderBy: { createdAt: "desc" },
        include: {
          winners: {
            orderBy: { rank: "asc" },
            include: { entry: true, prize: true }
          }
        }
      },
      _count: { select: { entries: true, draws: true } }
    }
  });

  if (!campaign) {
    notFound();
  }

  const draw = campaign.draws[0];
  const exportBase = `/admin/campaigns/${campaign.id}/exports`;
  const isArchived = campaign.status === "ARCHIVED";
  const canEditSetup = canEditCampaignSetup(campaign.status, campaign._count.draws);
  const canDelete = canDeleteCampaign(campaign.status, campaign._count.draws);

  return (
    <PageShell>
      <header className="flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusBadge>{campaign.status}</StatusBadge>
          <h1 className="mt-3 text-3xl font-bold">{campaign.title}</h1>
          <p className="mt-2 text-sm text-ink/68">
            {campaign._count.entries} entries · {campaign.prizes.length} prizes
          </p>
        </div>
        {campaign.isPublic && !isArchived ? (
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="text-moss" href={`/campaigns/${campaign.slug}`}>
              View public page
            </Link>
            {draw ? (
              <Link className="text-moss" href={`/campaigns/${campaign.slug}/verify`}>
                Draw record
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <h2 className="text-xl font-semibold">Campaign settings</h2>
          {!canEditSetup ? (
            <div className="mt-5 space-y-4 text-sm leading-6 text-ink/70">
              <p>
                {isArchived
                  ? "This campaign is archived. Restore it before changing eligible setup details."
                  : "This campaign has a completed draw. Campaign setup, entries, and prizes are locked to preserve the draw record."}
              </p>
              <div>
                <h3 className="font-semibold text-ink">Description</h3>
                <p className="whitespace-pre-wrap">{campaign.description}</p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Rules</h3>
                <p className="whitespace-pre-wrap">{campaign.rules}</p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Public entries</h3>
                <p>{campaign.allowPublicEntries ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
          ) : (
            <form action={updateCampaignAction} className="mt-5 space-y-5">
              <input name="campaignId" type="hidden" value={campaign.id} />
              <div>
                <Label>Title</Label>
                <TextInput name="title" required defaultValue={campaign.title} />
              </div>
              <div>
                <Label>Description</Label>
                <TextArea name="description" required defaultValue={campaign.description} />
              </div>
              <div>
                <Label>Rules</Label>
                <TextArea name="rules" required defaultValue={campaign.rules} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Starts at</Label>
                  <TextInput name="startsAt" type="datetime-local" defaultValue={formatDateInput(campaign.startsAt)} />
                </div>
                <div>
                  <Label>Ends at</Label>
                  <TextInput name="endsAt" type="datetime-local" defaultValue={formatDateInput(campaign.endsAt)} />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input name="isPublic" type="checkbox" className="h-4 w-4" defaultChecked={campaign.isPublic} disabled={campaign.status === "DRAWN"} />
                Publish campaign page
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input name="allowPublicEntries" type="checkbox" className="h-4 w-4" defaultChecked={campaign.allowPublicEntries} />
                Accept public entries
              </label>
              <SubmitButton>Save settings</SubmitButton>
            </form>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <h2 className="text-xl font-semibold">Campaign lifecycle</h2>
            <div className="mt-4 space-y-4">
              {isArchived ? (
                <form action={restoreCampaignAction}>
                  <input name="campaignId" type="hidden" value={campaign.id} />
                  <SubmitButton>Restore campaign</SubmitButton>
                </form>
              ) : (
                <form action={archiveCampaignAction}>
                  <input name="campaignId" type="hidden" value={campaign.id} />
                  <p className="mb-4 text-sm leading-6 text-ink/68">Archive hides this campaign from public and active admin lists while preserving records and exports.</p>
                  <SubmitButton>Archive campaign</SubmitButton>
                </form>
              )}

              {canDelete ? (
                <form action={deleteCampaignAction} className="border-t border-line pt-4">
                  <input name="campaignId" type="hidden" value={campaign.id} />
                  <p className="mb-3 text-sm leading-6 text-ink/68">Delete is only available for draft campaigns without draws. Type the title exactly to confirm.</p>
                  <Label>Type {campaign.title}</Label>
                  <TextInput name="confirmation" required />
                  <div className="mt-3">
                    <SubmitButton variant="danger">Delete campaign</SubmitButton>
                  </div>
                </form>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold">Run draw</h2>
            {isArchived ? (
              <p className="mt-4 text-sm leading-6 text-ink/68">Restore this campaign before running a draw.</p>
            ) : draw ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-semibold text-moss">Draw completed at {draw.createdAt.toLocaleString()}.</p>
                <p className="break-all font-mono text-xs text-ink/66">Seed hash: {draw.seedHash}</p>
              </div>
            ) : (
              <form action={runDrawAction} className="mt-4">
                <input name="campaignId" type="hidden" value={campaign.id} />
                <p className="mb-4 text-sm leading-6 text-ink/68">Running a draw records winners and locks final public results.</p>
                <SubmitButton>Run auditable draw</SubmitButton>
              </form>
            )}
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold">Exports</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <ExportLink href={`${exportBase}/entries`}>Entries CSV</ExportLink>
              {draw ? <ExportLink href={`${exportBase}/winners`}>Winners CSV</ExportLink> : null}
              <ExportLink href={`${exportBase}/audit`}>Audit CSV</ExportLink>
            </div>
          </Panel>

          {canEditSetup ? (
            <Panel>
              <h2 className="text-xl font-semibold">Add prize</h2>
              <form action={addPrizeAction} className="mt-4 space-y-4">
                <input name="campaignId" type="hidden" value={campaign.id} />
                <div>
                  <Label>Name</Label>
                  <TextInput name="name" required placeholder="Grand prize" />
                </div>
                <div>
                  <Label>Description</Label>
                  <TextInput name="description" placeholder="Optional prize details" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantity</Label>
                    <TextInput name="quantity" required type="number" min="1" defaultValue="1" />
                  </div>
                  <div>
                    <Label>Order</Label>
                    <TextInput name="sortOrder" type="number" min="0" defaultValue="0" />
                  </div>
                </div>
                <SubmitButton>Add prize</SubmitButton>
              </form>
            </Panel>
          ) : null}
        </div>
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold">Prizes</h2>
          <div className="mt-4 space-y-3">
            {campaign.prizes.length === 0 ? (
              <p className="text-sm text-ink/68">No prizes added.</p>
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
          <h2 className="text-xl font-semibold">Latest entries</h2>
          <div className="mt-4 space-y-3">
            {campaign.entries.length === 0 ? (
              <p className="text-sm text-ink/68">No entries added.</p>
            ) : (
              campaign.entries.map((entry) => (
                <div key={entry.id} className="rounded-md border border-line bg-white p-3">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">{entry.name}</h3>
                    <span className="font-mono text-xs text-ink/58">{entry.ticketCode}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink/64">{entry.email}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      {canEditSetup ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel>
            <h2 className="text-xl font-semibold">Add entry</h2>
            <form action={addEntryAction} className="mt-4 space-y-4">
              <input name="campaignId" type="hidden" value={campaign.id} />
              <div>
                <Label>Name</Label>
                <TextInput name="name" required />
              </div>
              <div>
                <Label>Email</Label>
                <TextInput name="email" type="email" required />
              </div>
              <div>
                <Label>Reference</Label>
                <TextInput name="reference" placeholder="Optional order or customer reference" />
              </div>
              <SubmitButton>Add entry</SubmitButton>
            </form>
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold">CSV import</h2>
            <form action={importEntriesAction} className="mt-4 space-y-4">
              <input name="campaignId" type="hidden" value={campaign.id} />
              <div>
                <Label>CSV rows</Label>
                <TextArea name="csv" required placeholder={"name,email,reference\nFatima Noor,fatima@example.com,INV-1001"} />
              </div>
              <SubmitButton>Import entries</SubmitButton>
            </form>
          </Panel>
        </section>
      ) : (
        !isArchived ? (
          <Panel className="mt-5">
            <h2 className="text-xl font-semibold">Setup locked</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              A completed draw exists for this campaign, so entries, prizes, imports, and campaign setup can no longer be changed.
            </p>
          </Panel>
        ) : null
      )}

      {draw ? (
        <Panel className="mt-5">
          <h2 className="text-xl font-semibold">Winners</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {draw.winners.map((winner) => (
              <li key={winner.id} className="rounded-md border border-line bg-paper/70 p-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold">#{winner.rank} {winner.entry.name}</span>
                  <span className="text-sm text-moss">{winner.prize.name}</span>
                </div>
                <p className="mt-1 text-sm text-ink/64">{winner.entry.email}</p>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </PageShell>
  );
}
