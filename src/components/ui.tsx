import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-white/82 p-5 shadow-soft ${className}`}>{children}</section>;
}

export function ButtonLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss ${className}`}
      {...props}
    />
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "danger" }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
        variant === "danger" ? "bg-brick hover:bg-red-800" : "bg-ink hover:bg-moss"
      }`}
      type="submit"
    >
      {children}
    </button>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
      {...props}
    />
  );
}

export function TextArea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      className="min-h-28 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-semibold text-ink">{children}</label>;
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold uppercase text-moss">{children}</span>;
}
