import Link from "next/link";
import { CalendarDays, Gift, Search, ShieldCheck, Ticket, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { createPublicEntryAction } from "@/app/campaigns/actions";
import { OperatorBrand } from "@/components/brand";
import { ButtonLink, Label, PageShell, Panel, StatusBadge, SubmitButton, TextInput } from "@/components/ui";
import { getAppSettings } from "@/lib/app-settings";
import { getPublicEntryStatus, type CampaignStatusValue, type PublicEntryStatus } from "@/lib/campaign-lifecycle";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function publicEntryStatusMessage(status: PublicEntryStatus): string {
  if (status === "not_started") {
    return "Entries are not open yet.";
  }

  if (status === "ended") {
    return "Entries are closed.";
  }

  if (status === "drawn") {
    return "This campaign is no longer accepting entries.";
  }

  if (status === "disabled" || status === "not_public") {
    return "This campaign is not accepting public entries.";
  }

  if (status === "not_open") {
    return "Entries are not open.";
  }

  return "Entries are open.";
}

function formatDateTime(value?: Date | null): string {
  return value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(value)
    : "Not set";
}

function publicEntryErrorMessage(error?: string): string | null {
  if (error === "duplicate-email") {
    return "This email is already entered for this campaign.";
  }

  if (error === "duplicate-reference") {
    return "This reference is already entered for this campaign.";
  }

  if (error === "invalid") {
    return "Check the entry form and try again.";
  }

  if (error === "closed") {
    return "Entries are not currently open for this campaign.";
  }

  if (error === "rate-limited") {
    return "Too many entry attempts. Try again later.";
  }

  if (error === "duplicate") {
    return "This entry could not be created because it duplicates an existing record.";
  }

  return null;
}

export default async function CampaignPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ entry?: string; ticket?: string }>;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
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
  const publicEntryStatus = getPublicEntryStatus({
    status: campaign.status as CampaignStatusValue,
    isPublic: campaign.isPublic,
    allowPublicEntries: campaign.allowPublicEntries,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    drawCount: campaign.draws.length
  });
  const entryError = publicEntryErrorMessage(resolvedSearchParams.entry);
  const entryStatusMessage = publicEntryStatusMessage(publicEntryStatus);

  return (
    <PageShell>
      <header className="py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-5">
              <OperatorBrand settings={settings} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge>{campaign.status}</StatusBadge>
              <span className="rounded-full border border-line bg-white/72 px-3 py-1 text-xs font-semibold text-ink/70">{entryStatusMessage}</span>
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">{campaign.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">{campaign.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaign.slug}/lookup`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
            >
              <Search size={18} aria-hidden="true" />
              Find my ticket
            </Link>
            {draw ? (
              <ButtonLink href={`/campaigns/${campaign.slug}/verify`} className="brand-bg gap-2">
                <ShieldCheck size={18} aria-hidden="true" />
                Draw record
              </ButtonLink>
            ) : null}
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-white/72 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-ink/56">
              <Ticket size={16} aria-hidden="true" />
              Entries
            </dt>
            <dd className="mt-2 text-2xl font-bold">{campaign._count.entries}</dd>
          </div>
          <div className="rounded-lg border border-line bg-white/72 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-ink/56">
              <Gift size={16} aria-hidden="true" />
              Prizes
            </dt>
            <dd className="mt-2 text-2xl font-bold">{campaign.prizes.length}</dd>
          </div>
          <div className="rounded-lg border border-line bg-white/72 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-ink/56">
              <CalendarDays size={16} aria-hidden="true" />
              Ends
            </dt>
            <dd className="mt-2 text-sm font-semibold">{formatDateTime(campaign.endsAt)}</dd>
          </div>
          <div className="rounded-lg border border-line bg-white/72 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-ink/56">
              <Trophy size={16} aria-hidden="true" />
              Result
            </dt>
            <dd className="mt-2 text-sm font-semibold">{draw ? "Draw completed" : "Awaiting draw"}</dd>
          </div>
        </dl>
      </header>

      {!draw ? (
        <Panel className="mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Enter campaign</h2>
              <p className="mt-2 text-sm leading-6 text-ink/68">
                Submit one entry with your name, email, and {campaign.requireLookupReference ? "required reference" : "optional reference"}. Keep your ticket code after entry.
              </p>
            </div>
            <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink/64">{entryStatusMessage}</span>
          </div>
          {resolvedSearchParams.ticket ? (
            <div className="mt-4 rounded-md border border-moss/30 bg-moss/10 p-4 text-sm">
              <p className="font-semibold text-moss">Entry received.</p>
              <p className="mt-2 text-ink/70">Your ticket code is:</p>
              <p className="mt-2 break-all font-mono text-lg font-bold text-ink">{resolvedSearchParams.ticket}</p>
              <Link className="mt-3 inline-block font-semibold brand-text" href={`/campaigns/${campaign.slug}/lookup`}>
                Open ticket lookup
              </Link>
            </div>
          ) : publicEntryStatus === "open" ? (
            <>
              {entryError ? <p className="mt-4 rounded-md border border-brick/30 bg-brick/10 p-3 text-sm text-brick">{entryError}</p> : null}
              <form action={createPublicEntryAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                <input name="slug" type="hidden" value={campaign.slug} />
                <div className="hp-field" aria-hidden="true">
                  <label htmlFor="entry-website">Website</label>
                  <input id="entry-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <div>
                  <Label>Name</Label>
                  <TextInput name="name" required maxLength={120} />
                </div>
                <div>
                  <Label>Email</Label>
                  <TextInput name="email" type="email" required maxLength={200} />
                </div>
                <div>
                  <Label>Reference</Label>
                  <TextInput name="reference" maxLength={120} required={campaign.requireLookupReference} placeholder={campaign.requireLookupReference ? "Required" : "Optional"} />
                </div>
                <SubmitButton>Enter</SubmitButton>
              </form>
            </>
          ) : (
            <p className="mt-4 rounded-md border border-line bg-paper/70 p-4 text-sm text-ink/68">{entryStatusMessage}</p>
          )}
        </Panel>
      ) : null}

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
              <dd className="font-semibold">{formatDateTime(campaign.startsAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/64">End</dt>
              <dd className="font-semibold">{formatDateTime(campaign.endsAt)}</dd>
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
            <div className="flex justify-between gap-4">
              <dt className="text-ink/64">Ticket lookup</dt>
              <dd className="font-semibold">
                <Link className="brand-text" href={`/campaigns/${campaign.slug}/lookup`}>
                  Find my ticket
                </Link>
                <span className="mt-1 block text-xs font-normal text-ink/58">{campaign.requireLookupReference ? "Reference required" : "Reference optional"}</span>
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-2">
            <Gift size={20} aria-hidden="true" />
            <h2 className="text-xl font-semibold">Prizes</h2>
          </div>
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
          <div className="flex items-center gap-2">
            <Trophy size={20} aria-hidden="true" />
            <h2 className="text-xl font-semibold">Draw results</h2>
          </div>
          {!draw ? (
            <p className="mt-4 text-sm text-ink/68">Results will appear here after the operator completes the draw.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <dl className="rounded-md border border-line bg-paper/70 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/64">Completed</dt>
                  <dd className="font-semibold">{formatDateTime(draw.createdAt)}</dd>
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
              <ButtonLink href={`/campaigns/${campaign.slug}/verify`} className="brand-bg gap-2">
                <ShieldCheck size={18} aria-hidden="true" />
                View draw record
              </ButtonLink>
            </div>
          )}
        </Panel>
      </section>
    </PageShell>
  );
}
