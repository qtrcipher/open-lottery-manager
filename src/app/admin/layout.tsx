import Link from "next/link";
import { logoutAction } from "@/app/admin/auth-actions";
import { OperatorBrand } from "@/components/brand";
import { getAppSettings } from "@/lib/app-settings";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, settings] = await Promise.all([getSession(), getAppSettings()]);

  return (
    <div>
      <header className="border-b border-line bg-white/85">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <OperatorBrand href="/admin" settings={settings} />
          <div className="flex items-center gap-3 text-sm">
            {session ? <span className="text-ink/64">{session.email}</span> : null}
            {session ? (
              <Link className="font-semibold text-moss" href="/admin/settings">
                Settings
              </Link>
            ) : null}
            <Link className="font-semibold text-moss" href="/">
              Public site
            </Link>
            {session ? (
              <form action={logoutAction}>
                <button className="font-semibold text-brick" type="submit">
                  Logout
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
