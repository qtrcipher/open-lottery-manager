import Link from "next/link";
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
      <header className="flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-5">
            <OperatorBrand settings={settings} />
          </div>
          <h1 className="text-4xl font-bold">{campaign.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">Find your ticket code and entry status for this campaign.</p>
        </div>
        <Link className="brand-text font-semibold" href={`/campaigns/${campaign.slug}`}>
          Back to campaign
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <h2 className="text-xl font-semibold">Find my ticket</h2>
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
                <dd className="font-semibold">{entry.createdAt.toLocaleString()}</dd>
              </div>
            </dl>
          ) : lookupMessage ? (
            <p className="mt-4 rounded-md border border-brick/30 bg-brick/10 p-3 text-sm text-brick">{lookupMessage}</p>
          ) : (
            <p className="mt-4 text-sm leading-6 text-ink/70">Enter the email used for your campaign entry. If the operator gave you a reference, include it to narrow the lookup.</p>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
