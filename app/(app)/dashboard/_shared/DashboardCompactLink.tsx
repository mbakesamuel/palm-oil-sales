import Link from "next/link";

export function DashboardCompactLink(props: {
  href: string;
  title: string;
  description?: string;
}) {
  const { href, title, description } = props;
  return (
    <Link
      href={href}
      className="flex min-h-0 flex-col justify-center overflow-hidden rounded-md border border-border bg-background px-2 py-1.5 shadow-sm hover:bg-accent/20 sm:px-3 sm:py-2"
    >
      <div className="truncate text-xs font-medium sm:text-sm">{title}</div>
      {description ? (
        <div className="truncate text-[10px] opacity-75 sm:text-xs">{description}</div>
      ) : null}
    </Link>
  );
}
