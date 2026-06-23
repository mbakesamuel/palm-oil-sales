"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { normalizeServiceCodeParam } from "@/lib/dashboard-routing";

export type DashboardLineNavItem = {
  code: string;
  name: string;
  href: string;
};

function SidebarBlock(props: { title: string; children: ReactNode }) {
  return (
    <div className="shrink-0 rounded-md border border-border bg-background p-1.5 shadow-sm sm:p-2">
      <div className="shrink-0 text-[9px] font-semibold uppercase tracking-wide opacity-70 sm:text-[10px]">
        {props.title}
      </div>
      <div className="mt-0.5 text-[10px] sm:text-xs">{props.children}</div>
    </div>
  );
}

function linkClass(active: boolean): string {
  return [
    "block truncate rounded px-1.5 py-0.5 transition-colors",
    active
      ? "bg-brand/15 font-medium text-brand"
      : "text-foreground/85 hover:bg-accent/25 hover:text-brand",
  ].join(" ");
}

export function DashboardLineSwitcherNav(props: {
  executiveHref: string;
  lines: DashboardLineNavItem[];
}) {
  const pathname = usePathname();
  const path = pathname.split("?")[0].toLowerCase();
  const executiveActive = path === props.executiveHref.toLowerCase();
  const lineSegment = path.match(/^\/dashboard\/([^/]+)/)?.[1] ?? null;
  const activeLineCode = lineSegment
    ? normalizeServiceCodeParam(lineSegment)
    : null;

  return (
    <SidebarBlock title="Commercial lines">
      <ul className="space-y-0.5">
        <li>
          <Link
            href={props.executiveHref}
            className={linkClass(executiveActive)}
            aria-current={executiveActive ? "page" : undefined}
          >
            Executive overview
          </Link>
        </li>
        {props.lines.map((line) => {
          const active =
            !executiveActive &&
            activeLineCode != null &&
            normalizeServiceCodeParam(line.code) === activeLineCode;
          return (
            <li key={line.code}>
              <Link
                href={line.href}
                className={linkClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {line.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </SidebarBlock>
  );
}
