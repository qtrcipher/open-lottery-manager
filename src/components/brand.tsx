/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

type OperatorBrandSettings = {
  operatorName: string;
  logoUrl?: string | null;
};

export function OperatorBrand({
  settings,
  href = "/",
  className = ""
}: {
  settings: OperatorBrandSettings;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      {settings.logoUrl ? (
        <img
          alt={`${settings.operatorName} logo`}
          className="h-10 w-10 rounded-md border border-line bg-white object-contain p-1"
          src={settings.logoUrl}
        />
      ) : (
        <span className="brand-bg flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white" aria-hidden="true">
          {settings.operatorName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="font-bold">{settings.operatorName}</span>
    </>
  );

  if (!href) {
    return <div className={`inline-flex items-center gap-3 ${className}`}>{content}</div>;
  }

  return (
    <Link href={href} className={`inline-flex items-center gap-3 ${className}`}>
      {content}
    </Link>
  );
}
