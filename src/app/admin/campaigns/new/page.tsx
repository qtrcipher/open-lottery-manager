import { createCampaignAction } from "@/app/admin/actions";
import { Label, PageShell, Panel, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  await requireAdmin();

  return (
    <PageShell>
      <div className="max-w-3xl py-8">
        <h1 className="text-3xl font-bold">New campaign</h1>
        <Panel className="mt-6">
          <form action={createCampaignAction} className="space-y-5">
            <div>
              <Label>Title</Label>
              <TextInput name="title" required placeholder="Summer prize draw" />
            </div>
            <div>
              <Label>Description</Label>
              <TextArea name="description" required placeholder="Short public explanation of the campaign." />
            </div>
            <div>
              <Label>Rules</Label>
              <TextArea name="rules" required placeholder="Eligibility, prize terms, claim deadlines, and operator notes." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Starts at</Label>
                <TextInput name="startsAt" type="datetime-local" />
              </div>
              <div>
                <Label>Ends at</Label>
                <TextInput name="endsAt" type="datetime-local" />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input name="isPublic" type="checkbox" className="h-4 w-4" />
              Publish campaign page
            </label>
            <SubmitButton>Create campaign</SubmitButton>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
