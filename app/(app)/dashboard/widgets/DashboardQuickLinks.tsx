import Link from "next/link";
import type { CommercialModuleKey } from "@/lib/commercial-modules";
import { quickLinksForModules } from "@/lib/dashboard-widgets";

export function DashboardQuickLinks(props: {
  enabledModules: readonly CommercialModuleKey[];
}) {
  const links = quickLinksForModules(props.enabledModules);
  if (links.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg border border-border p-4 hover:bg-accent/25"
        >
          <div className="font-medium">{link.title}</div>
          <div className="text-sm opacity-75">{link.description}</div>
        </Link>
      ))}
    </div>
  );
}
