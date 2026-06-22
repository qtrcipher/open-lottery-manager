import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2, Search, Ticket } from "lucide-react";
import { notFound } from "next/navigation";
import { lookupTicketAction } from "@/app/campaigns/actions";
import { OperatorBrand } from "@/components/brand";
import { Label, PageShell, Panel, SubmitButton, TextInput } from "@/components/ui";
import { getAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function lookupStatusMessage(status?: string): string | null {
  if (status === "rate-limited") {
    return "Too many lookup attempts. Try again later.";
  }

  if (status === "not-found" || status === "found") {
    return "No matching entry was found.";
  }

  return null;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function TicketLookupPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; ticket?: string }>;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const [settings, campaign] = await Promise.all([
    getAppSettings(),
    prisma.campaign.findFirst({
      where: { slug: resolvedParams.slug, isPublic: true, status: { not: "ARCHIVED" } },
      select: { id: true, slug: true, title: true }
    })
  ]);

  if (!campaign) {
    notFound();
  }

  const lookupMessage = lookupStatusMessage(resolvedSearchParams.status);
  const entry =
    resolvedSearchParams.status === "found" && resolvedSearchParams.ticket
      ? await prisma.entry.findFirst({
          where: { campaignId: campaign.id, ticketCode: resolvedSearchParams.ticket },
          select: { ticketCode: true, isEligible: true, createdAt: true }
        })
      : null;

  return (
    <PageShell>
      <header className="flex flex-col gap-5 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-5">
            <OperatorBrand settings={settings} />
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold brand-text">
            <Ticket size={18} aria-hidden="true" />
            Ticket lookup
          </div>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight">{campaign.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">Find your ticket code and entry status for this campaign.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper" href={`/campaigns/${campaign.slug}`}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back to campaign
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <Search size={20} aria-hidden="true" />
            <h2 className="text-xl font-semibold">Find my ticket</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/68">Use the same email used for entry. Add the reference if the operator provided one.</p>
          <form action={lookupTicketAction} className="mt-4 space-y-4">
            <input name="slug" type="hidden" value={campaign.slug} />
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="lookup-website">Website</label>
              <input id="lookup-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div>
              <Label>Email</Label>
              <TextInput name="email" type="email" required maxLength={200} />
            </div>
            <div>
              <Label>Reference</Label>
              <TextInput name="reference" maxLength={120} placeholder="Optional" />
            </div>
            <SubmitButton>Look up ticket</SubmitButton>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Lookup result</h2>
          {entry ? (
            <div className="mt-4 rounded-md border border-moss/30 bg-moss/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-moss">
                <CheckCircle2 size={20} aria-hidden="true" />
                Ticket found
              </div>
              <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-ink/64">Ticket code</dt>
                <dd className="mt-1 break-all font-mono text-lg font-bold">{entry.ticketCode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/64">Entry status</dt>
                <dd className="font-semibold">{entry.isEligible ? "Eligible" : "Not eligible"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/64">Entered</dt>
                <dd className="font-semibold">{formatDateTime(entry.createdAt)}</dd>
              </div>
              </dl>
            </div>
          ) : lookupMessage ? (
            <div className="mt-4 flex gap-3 rounded-md border border-brick/30 bg-brick/10 p-4 text-sm text-brick">
              <AlertCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{lookupMessage}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-line bg-paper/70 p-4 text-sm leading-6 text-ink/70">
              Enter the email used for your campaign entry. If the operator gave you a reference, include it to narrow the lookup.
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
