import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import type { Prisma } from "@prisma/client";
import {
  addEntryAction,
  addPrizeAction,
  archiveCampaignAction,
  deleteCampaignAction,
  deleteEntryAction,
  importEntriesAction,
  restoreCampaignAction,
  runDrawAction,
  updateCampaignAction,
  updateEntryAction
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

function entryMessageText(message?: string): string | null {
  if (message === "created") {
    return "Participant added.";
  }

  if (message === "updated") {
    return "Participant updated.";
  }

  if (message === "deleted") {
    return "Participant deleted.";
  }

  if (message === "duplicate-email") {
    return "Another participant already uses this email.";
  }

  if (message === "duplicate-reference") {
    return "Another participant already uses this reference.";
  }

  if (message === "duplicate") {
    return "This participant duplicates an existing record.";
  }

  return null;
}

function entryStatusFilter(value?: string): "all" | "eligible" | "ineligible" {
  if (value === "eligible" || value === "ineligible") {
    return value;
  }

  return "all";
}

function EntryReturnFields({ entrySearch, entryStatus }: { entrySearch: string; entryStatus: string }) {
  return (
    <>
      <input name="returnEntrySearch" type="hidden" value={entrySearch} />
      <input name="returnEntryStatus" type="hidden" value={entryStatus} />
    </>
  );
}

export default async function CampaignAdminPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ entrySearch?: string; entryStatus?: string; entryMessage?: string }>;
}) {
  await requireAdmin();
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const entrySearch = String(resolvedSearchParams.entrySearch ?? "").trim();
  const selectedEntryStatus = entryStatusFilter(resolvedSearchParams.entryStatus);

  const campaign = await prisma.campaign.findUnique({
    where: { id: resolvedParams.id },
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
  const entryWhere: Prisma.EntryWhereInput = {
    campaignId: campaign.id,
    ...(selectedEntryStatus === "eligible" ? { isEligible: true } : {}),
    ...(selectedEntryStatus === "ineligible" ? { isEligible: false } : {}),
    ...(entrySearch
      ? {
          OR: [
            { name: { contains: entrySearch } },
            { email: { contains: entrySearch.toLowerCase() } },
            { reference: { contains: entrySearch } },
            { ticketCode: { contains: entrySearch } }
          ]
        }
      : {})
  };
  const [entries, eligibleEntryCount, ineligibleEntryCount] = await Promise.all([
    prisma.entry.findMany({
      where: entryWhere,
      orderBy: { createdAt: "desc" }
    }),
    prisma.entry.count({ where: { campaignId: campaign.id, isEligible: true } }),
    prisma.entry.count({ where: { campaignId: campaign.id, isEligible: false } })
  ]);
  const entryMessage = entryMessageText(resolvedSearchParams.entryMessage);

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

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Participants</h2>
              <p className="mt-1 text-sm text-ink/64">Search, review, and manage campaign entries before the draw.</p>
            </div>
            {!canEditSetup ? <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold uppercase text-ink/60">Read only</span> : null}
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/60">Total</dt>
              <dd className="mt-1 text-xl font-bold">{campaign._count.entries}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/60">Eligible</dt>
              <dd className="mt-1 text-xl font-bold text-moss">{eligibleEntryCount}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/60">Ineligible</dt>
              <dd className="mt-1 text-xl font-bold text-brick">{ineligibleEntryCount}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/60">Visible</dt>
              <dd className="mt-1 text-xl font-bold">{entries.length}</dd>
            </div>
          </dl>

          {entryMessage ? (
            <p
              className={`mt-4 rounded-md border p-3 text-sm ${
                resolvedSearchParams.entryMessage?.startsWith("duplicate")
                  ? "border-brick/30 bg-brick/10 text-brick"
                  : "border-moss/30 bg-moss/10 text-moss"
              }`}
            >
              {entryMessage}
            </p>
          ) : null}

          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_12rem_auto_auto] md:items-end" method="get">
            <div>
              <Label>Search participants</Label>
              <TextInput name="entrySearch" defaultValue={entrySearch} placeholder="Name, email, ticket, or reference" />
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
                name="entryStatus"
                defaultValue={selectedEntryStatus}
              >
                <option value="all">All entries</option>
                <option value="eligible">Eligible</option>
                <option value="ineligible">Ineligible</option>
              </select>
            </div>
            <SubmitButton>Filter</SubmitButton>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
              href={`/admin/campaigns/${campaign.id}`}
            >
              Reset
            </Link>
          </form>

          <div className="mt-4 overflow-x-auto">
            {entries.length === 0 ? (
              <p className="rounded-md border border-line bg-paper/70 p-4 text-sm text-ink/68">No participants match the current filters.</p>
            ) : (
              <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink/58">
                    <th className="border-b border-line px-3 py-2 font-semibold">Participant</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Reference</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Ticket</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Eligible</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Entered</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const updateFormId = `entry-update-${entry.id}`;

                    return (
                      <tr key={entry.id} className="align-top">
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <div className="grid gap-2">
                              <TextInput aria-label="Participant name" form={updateFormId} name="name" required defaultValue={entry.name} maxLength={120} />
                              <TextInput aria-label="Participant email" form={updateFormId} name="email" type="email" required defaultValue={entry.email} maxLength={200} />
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold">{entry.name}</p>
                              <p className="mt-1 text-ink/64">{entry.email}</p>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <TextInput
                              aria-label="Participant reference"
                              form={updateFormId}
                              name="reference"
                              defaultValue={entry.reference ?? ""}
                              maxLength={120}
                              placeholder="Optional"
                            />
                          ) : (
                            <span className="text-ink/70">{entry.reference || "None"}</span>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          <span className="break-all font-mono text-xs text-ink/64">{entry.ticketCode}</span>
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                              <input className="h-4 w-4" form={updateFormId} name="isEligible" type="checkbox" defaultChecked={entry.isEligible} />
                              Eligible
                            </label>
                          ) : (
                            <span className={`font-semibold ${entry.isEligible ? "text-moss" : "text-brick"}`}>
                              {entry.isEligible ? "Eligible" : "Ineligible"}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3 text-ink/64">{entry.createdAt.toLocaleString()}</td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <div className="flex flex-wrap gap-2">
                              <form id={updateFormId} action={updateEntryAction}>
                                <input name="campaignId" type="hidden" value={campaign.id} />
                                <input name="entryId" type="hidden" value={entry.id} />
                                <EntryReturnFields entrySearch={entrySearch} entryStatus={selectedEntryStatus} />
                                <SubmitButton>Save</SubmitButton>
                              </form>
                              <form action={deleteEntryAction}>
                                <input name="campaignId" type="hidden" value={campaign.id} />
                                <input name="entryId" type="hidden" value={entry.id} />
                                <EntryReturnFields entrySearch={entrySearch} entryStatus={selectedEntryStatus} />
                                <SubmitButton variant="danger">Delete</SubmitButton>
                              </form>
                            </div>
                          ) : (
                            <span className="text-ink/54">Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
