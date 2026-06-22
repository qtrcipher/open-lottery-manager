import { updateAppSettingsAction } from "@/app/admin/actions";
import { Label, PageShell, Panel, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { getAppSettings } from "@/lib/app-settings";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const [settings, resolvedSearchParams] = await Promise.all([getAppSettings(), searchParams]);

  return (
    <PageShell>
      <header className="py-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-ink/68">Customize the operator identity shown on public campaign pages.</p>
      </header>

      <Panel>
        {resolvedSearchParams.saved === "1" ? (
          <p className="mb-5 rounded-md border border-moss/30 bg-moss/10 p-3 text-sm font-semibold text-moss">Settings saved.</p>
        ) : null}
        <form action={updateAppSettingsAction} className="space-y-5">
          <div>
            <Label>Operator name</Label>
            <TextInput name="operatorName" defaultValue={settings.operatorName} maxLength={120} required />
          </div>
          <div>
            <Label>Public tagline</Label>
            <TextArea name="publicTagline" defaultValue={settings.publicTagline} maxLength={280} required />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label>Support email</Label>
              <TextInput name="supportEmail" type="email" defaultValue={settings.supportEmail ?? ""} maxLength={200} />
            </div>
            <div>
              <Label>Logo URL</Label>
              <TextInput name="logoUrl" type="url" defaultValue={settings.logoUrl ?? ""} maxLength={500} />
            </div>
          </div>
          <div>
            <Label>Primary brand color</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TextInput name="brandColor" type="text" defaultValue={settings.brandColor} pattern="#[0-9a-fA-F]{6}" required />
              <span
                className="h-11 w-full rounded-md border border-line sm:w-28"
                style={{ backgroundColor: settings.brandColor }}
                aria-hidden="true"
              />
            </div>
          </div>
          <SubmitButton>Save settings</SubmitButton>
        </form>
      </Panel>
    </PageShell>
  );
}
