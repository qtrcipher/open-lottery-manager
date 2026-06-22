import { KeyRound } from "lucide-react";
import { loginAction } from "@/app/admin/auth-actions";
import { Label, PageShell, Panel, SubmitButton, TextInput } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const message =
    resolvedSearchParams.error === "missing-config"
      ? "Admin credentials are not configured. Check .env."
      : resolvedSearchParams.error === "invalid"
        ? "Email or password is incorrect."
        : null;

  return (
    <PageShell>
      <div className="mx-auto max-w-md py-16">
        <Panel>
          <KeyRound className="mb-4 text-gold" size={32} aria-hidden="true" />
          <h1 className="text-2xl font-bold">Admin login</h1>
          <p className="mt-2 text-sm leading-6 text-ink/68">Access campaign setup, entry management, and draw operations.</p>
          {message ? <p className="mt-4 rounded-md border border-brick/30 bg-brick/10 p-3 text-sm text-brick">{message}</p> : null}
          <form action={loginAction} className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <TextInput name="email" type="email" autoComplete="email" required />
            </div>
            <div>
              <Label>Password</Label>
              <TextInput name="password" type="password" autoComplete="current-password" required />
            </div>
            <SubmitButton>Sign in</SubmitButton>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
