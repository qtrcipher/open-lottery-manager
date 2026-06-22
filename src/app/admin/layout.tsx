import Link from "next/link";
import { logoutAction } from "@/app/admin/auth-actions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div>
      <header className="border-b border-line bg-white/85">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/admin" className="text-lg font-bold">
            Open Lottery Manager
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {session ? <span className="text-ink/64">{session.email}</span> : null}
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
