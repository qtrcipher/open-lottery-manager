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
  deletePrizeAction,
  restoreCampaignAction,
  runDrawAction,
  updateCampaignAction,
  updateEntryAction,
  updatePrizeAction
} from "@/app/admin/actions";
import { CsvImportForm } from "@/components/csv-import-form";
import { Label, PageShell, Panel, StatusBadge, SubmitButton, TextArea, TextInput } from "@/components/ui";
import {
  auditLogPageSize,
  auditLogQueryString,
  auditLogSkip,
  buildAuditLogWhere,
  campaignAuditBaseWhere,
  clampAuditLogPage,
  parseAuditLogFilters
} from "@/lib/audit-log";
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

function prizeMessageText(message?: string): string | null {
  if (message === "created") {
    return "Prize added.";
  }

  if (message === "updated") {
    return "Prize updated.";
  }

  if (message === "deleted") {
    return "Prize deleted.";
  }

  return null;
}

type EntryStatusFilter = "all" | "eligible" | "ineligible" | "approved" | "flagged" | "rejected";

function entryStatusFilter(value?: string): EntryStatusFilter {
  if (value === "eligible" || value === "ineligible" || value === "approved" || value === "flagged" || value === "rejected") {
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
  searchParams: Promise<{
    entrySearch?: string;
    entryStatus?: string;
    entryMessage?: string;
    prizeMessage?: string;
    auditSearch?: string;
    auditAction?: string;
    auditEntityType?: string;
    auditFrom?: string;
    auditTo?: string;
    auditPage?: string;
  }>;
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
  const campaignAdminBase = `/admin/campaigns/${campaign.id}`;
  const isArchived = campaign.status === "ARCHIVED";
  const canEditSetup = canEditCampaignSetup(campaign.status, campaign._count.draws);
  const canDelete = canDeleteCampaign(campaign.status, campaign._count.draws);
  const auditFilters = parseAuditLogFilters(resolvedSearchParams);
  const auditBaseWhere = campaignAuditBaseWhere(campaign.id);
  const auditWhere = buildAuditLogWhere(campaign.id, auditFilters);
  const entryWhere: Prisma.EntryWhereInput = {
    campaignId: campaign.id,
    ...(selectedEntryStatus === "eligible" ? { isEligible: true } : {}),
    ...(selectedEntryStatus === "ineligible" ? { isEligible: false } : {}),
    ...(selectedEntryStatus === "approved" ? { reviewStatus: "APPROVED" } : {}),
    ...(selectedEntryStatus === "flagged" ? { reviewStatus: "FLAGGED" } : {}),
    ...(selectedEntryStatus === "rejected" ? { reviewStatus: "REJECTED" } : {}),
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
  const [entries, eligibleEntryCount, ineligibleEntryCount, flaggedEntryCount, rejectedEntryCount] = await Promise.all([
    prisma.entry.findMany({
      where: entryWhere,
      orderBy: { createdAt: "desc" }
    }),
    prisma.entry.count({ where: { campaignId: campaign.id, isEligible: true } }),
    prisma.entry.count({ where: { campaignId: campaign.id, isEligible: false } }),
    prisma.entry.count({ where: { campaignId: campaign.id, reviewStatus: "FLAGGED" } }),
    prisma.entry.count({ where: { campaignId: campaign.id, reviewStatus: "REJECTED" } })
  ]);
  const auditTotalCount = await prisma.auditLog.count({ where: auditWhere });
  const auditPage = clampAuditLogPage(auditFilters.page, auditTotalCount);
  const [auditLogs, auditOptionLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      skip: auditLogSkip(auditPage),
      take: auditLogPageSize
    }),
    prisma.auditLog.findMany({
      where: auditBaseWhere,
      select: { action: true, entityType: true },
      orderBy: [{ action: "asc" }, { entityType: "asc" }]
    })
  ]);
  const auditActionOptions = Array.from(new Set(auditOptionLogs.map((log) => log.action))).sort();
  const auditEntityTypeOptions = Array.from(new Set(auditOptionLogs.map((log) => log.entityType))).sort();
  const auditPageCount = Math.max(1, Math.ceil(auditTotalCount / auditLogPageSize));
  const auditPreviousQuery = auditLogQueryString(auditFilters, { page: auditPage - 1 });
  const auditNextQuery = auditLogQueryString(auditFilters, { page: auditPage + 1 });
  const entryMessage = entryMessageText(resolvedSearchParams.entryMessage);
  const prizeMessage = prizeMessageText(resolvedSearchParams.prizeMessage);

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
                <h3 className="font-semibold text-ink">Structured disclosures</h3>
                <dl className="mt-2 grid gap-2">
                  <div>
                    <dt className="font-semibold">Timezone</dt>
                    <dd>{campaign.timezone}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Scheduled draw</dt>
                    <dd>{campaign.drawScheduledAt ? campaign.drawScheduledAt.toLocaleString() : "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Sponsor</dt>
                    <dd>{campaign.sponsorName || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Eligibility</dt>
                    <dd className="whitespace-pre-wrap">{campaign.eligibilitySummary || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Prize value</dt>
                    <dd className="whitespace-pre-wrap">{campaign.prizeValueSummary || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Jurisdiction notice</dt>
                    <dd className="whitespace-pre-wrap">{campaign.jurisdictionNotice || "Not set"}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Public entries</h3>
                <p>{campaign.allowPublicEntries ? "Enabled" : "Disabled"}</p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Lookup reference</h3>
                <p>{campaign.requireLookupReference ? "Required" : "Optional"}</p>
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
                  <Label>Timezone</Label>
                  <TextInput name="timezone" required defaultValue={campaign.timezone} placeholder="UTC" />
                </div>
                <div>
                  <Label>Scheduled draw</Label>
                  <TextInput name="drawScheduledAt" type="datetime-local" defaultValue={formatDateInput(campaign.drawScheduledAt)} />
                </div>
              </div>
              <div>
                <Label>Sponsor or operator</Label>
                <TextInput name="sponsorName" defaultValue={campaign.sponsorName ?? ""} placeholder="Optional public sponsor name" />
              </div>
              <div>
                <Label>Eligibility summary</Label>
                <TextArea name="eligibilitySummary" defaultValue={campaign.eligibilitySummary ?? ""} />
              </div>
              <div>
                <Label>Prize value summary</Label>
                <TextArea name="prizeValueSummary" defaultValue={campaign.prizeValueSummary ?? ""} />
              </div>
              <div>
                <Label>Jurisdiction notice</Label>
                <TextArea name="jurisdictionNotice" defaultValue={campaign.jurisdictionNotice ?? ""} />
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
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input name="requireLookupReference" type="checkbox" className="h-4 w-4" defaultChecked={campaign.requireLookupReference} />
                Require reference for public entry and ticket lookup
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
                {draw.verificationBundleHash ? <p className="break-all font-mono text-xs text-ink/66">Bundle hash: {draw.verificationBundleHash}</p> : null}
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

      <section className="mt-5 space-y-5">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Prizes</h2>
              <p className="mt-1 text-sm text-ink/64">Manage prize quantities and draw order before the draw.</p>
            </div>
            {!canEditSetup ? <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold uppercase text-ink/60">Read only</span> : null}
          </div>

          {prizeMessage ? <p className="mt-4 rounded-md border border-moss/30 bg-moss/10 p-3 text-sm text-moss">{prizeMessage}</p> : null}

          <div className="mt-4 overflow-x-auto">
            {campaign.prizes.length === 0 ? (
              <p className="rounded-md border border-line bg-paper/70 p-4 text-sm text-ink/68">No prizes added.</p>
            ) : (
              <table className="min-w-[860px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink/58">
                    <th className="border-b border-line px-3 py-2 font-semibold">Prize</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Description</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Quantity</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Order</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.prizes.map((prize) => {
                    const updateFormId = `prize-update-${prize.id}`;

                    return (
                      <tr key={prize.id} className="align-top">
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <TextInput aria-label="Prize name" form={updateFormId} name="name" required defaultValue={prize.name} maxLength={120} />
                          ) : (
                            <p className="font-semibold">{prize.name}</p>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <TextInput
                              aria-label="Prize description"
                              form={updateFormId}
                              name="description"
                              defaultValue={prize.description ?? ""}
                              maxLength={1000}
                              placeholder="Optional"
                            />
                          ) : (
                            <span className="text-ink/70">{prize.description || "None"}</span>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <TextInput
                              aria-label="Prize quantity"
                              form={updateFormId}
                              name="quantity"
                              required
                              type="number"
                              min="1"
                              max="1000"
                              defaultValue={prize.quantity}
                            />
                          ) : (
                            <span className="font-semibold">x{prize.quantity}</span>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <TextInput
                              aria-label="Prize order"
                              form={updateFormId}
                              name="sortOrder"
                              type="number"
                              min="0"
                              max="10000"
                              defaultValue={prize.sortOrder}
                            />
                          ) : (
                            <span className="text-ink/70">{prize.sortOrder}</span>
                          )}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <div className="flex flex-wrap gap-2">
                              <form id={updateFormId} action={updatePrizeAction}>
                                <input name="campaignId" type="hidden" value={campaign.id} />
                                <input name="prizeId" type="hidden" value={prize.id} />
                                <SubmitButton>Save</SubmitButton>
                              </form>
                              <form action={deletePrizeAction}>
                                <input name="campaignId" type="hidden" value={campaign.id} />
                                <input name="prizeId" type="hidden" value={prize.id} />
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

        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Participants</h2>
              <p className="mt-1 text-sm text-ink/64">Search, review, and manage campaign entries before the draw.</p>
            </div>
            {!canEditSetup ? <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold uppercase text-ink/60">Read only</span> : null}
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
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
              <dt className="text-ink/60">Flagged</dt>
              <dd className="mt-1 text-xl font-bold text-brick">{flaggedEntryCount}</dd>
            </div>
            <div className="rounded-md border border-line bg-paper/70 p-3">
              <dt className="text-ink/60">Rejected</dt>
              <dd className="mt-1 text-xl font-bold">{rejectedEntryCount}</dd>
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
                <option value="approved">Approved</option>
                <option value="flagged">Flagged</option>
                <option value="rejected">Rejected</option>
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
              <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink/58">
                    <th className="border-b border-line px-3 py-2 font-semibold">Participant</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Reference</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Ticket</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Eligible</th>
                    <th className="border-b border-line px-3 py-2 font-semibold">Review</th>
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
                        <td className="border-b border-line px-3 py-3">
                          {canEditSetup ? (
                            <div className="grid min-w-48 gap-2">
                              <select
                                aria-label="Review status"
                                className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
                                form={updateFormId}
                                name="reviewStatus"
                                defaultValue={entry.reviewStatus}
                              >
                                <option value="APPROVED">Approved</option>
                                <option value="FLAGGED">Flagged</option>
                                <option value="REJECTED">Rejected</option>
                              </select>
                              <TextArea
                                aria-label="Review notes"
                                form={updateFormId}
                                name="reviewNotes"
                                defaultValue={entry.reviewNotes ?? ""}
                                maxLength={1000}
                                placeholder={entry.riskFlags ? `Flags: ${entry.riskFlags}` : "Review notes"}
                              />
                            </div>
                          ) : (
                            <div>
                              <span className={`font-semibold ${entry.reviewStatus === "APPROVED" ? "text-moss" : "text-brick"}`}>
                                {entry.reviewStatus}
                              </span>
                              {entry.riskFlags ? <p className="mt-1 text-xs text-ink/58">Flags: {entry.riskFlags}</p> : null}
                              {entry.reviewNotes ? <p className="mt-1 text-xs text-ink/58">{entry.reviewNotes}</p> : null}
                            </div>
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
            <CsvImportForm campaignId={campaign.id} />
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

      <Panel className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Audit log</h2>
            <p className="mt-1 text-sm text-ink/64">Search and review campaign activity records.</p>
          </div>
          <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold uppercase text-ink/60">
            {auditTotalCount} matching
          </span>
        </div>

        <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_12rem_12rem_11rem_11rem_auto_auto] lg:items-end" method="get">
          {entrySearch ? <input name="entrySearch" type="hidden" value={entrySearch} /> : null}
          {selectedEntryStatus !== "all" ? <input name="entryStatus" type="hidden" value={selectedEntryStatus} /> : null}
          <div>
            <Label>Search audit</Label>
            <TextInput name="auditSearch" defaultValue={auditFilters.search} placeholder="Action, entity, id, or metadata" />
          </div>
          <div>
            <Label>Action</Label>
            <select
              className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
              name="auditAction"
              defaultValue={auditFilters.action}
            >
              <option value="">All actions</option>
              {auditActionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Entity type</Label>
            <select
              className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
              name="auditEntityType"
              defaultValue={auditFilters.entityType}
            >
              <option value="">All entities</option>
              {auditEntityTypeOptions.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>From</Label>
            <TextInput name="auditFrom" type="datetime-local" defaultValue={auditFilters.fromInput} />
          </div>
          <div>
            <Label>To</Label>
            <TextInput name="auditTo" type="datetime-local" defaultValue={auditFilters.toInput} />
          </div>
          <SubmitButton>Filter</SubmitButton>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
            href={campaignAdminBase}
          >
            Reset
          </Link>
        </form>

        <div className="mt-4 overflow-x-auto">
          {auditLogs.length === 0 ? (
            <p className="rounded-md border border-line bg-paper/70 p-4 text-sm text-ink/68">No audit records match the current filters.</p>
          ) : (
            <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink/58">
                  <th className="border-b border-line px-3 py-2 font-semibold">Timestamp</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Action</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Entity</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Entity id</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="border-b border-line px-3 py-3 text-ink/64">{log.createdAt.toLocaleString()}</td>
                    <td className="border-b border-line px-3 py-3 font-semibold">{log.action}</td>
                    <td className="border-b border-line px-3 py-3 text-ink/70">{log.entityType}</td>
                    <td className="border-b border-line px-3 py-3">
                      <span className="break-all font-mono text-xs text-ink/64">{log.entityId}</span>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <span className="break-all font-mono text-xs text-ink/64">{log.metadata ?? "None"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-ink/68 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Page {auditPage} of {auditPageCount}
          </p>
          <div className="flex flex-wrap gap-2">
            {auditPage > 1 ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink transition hover:border-moss hover:text-moss"
                href={`${campaignAdminBase}${auditPreviousQuery ? `?${auditPreviousQuery}` : ""}`}
              >
                Previous
              </Link>
            ) : null}
            {auditPage < auditPageCount ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink transition hover:border-moss hover:text-moss"
                href={`${campaignAdminBase}${auditNextQuery ? `?${auditNextQuery}` : ""}`}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
