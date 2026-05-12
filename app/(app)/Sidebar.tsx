"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/auth-display";
import { PERMISSION_KEYS } from "@/lib/access-control-keys";
import { getRolePermissionsAction } from "@/app/(app)/setup/permissions/actions";
import { SignOutButton } from "../forbidden/SignOutButton";

type NavItem = { href: string; label: string };

type NavGroupConfig = {
  id: string;
  label: string;
  items: NavItem[];
  /** Narrow sidebar: one shortcut link */
  collapsedHref: string;
  collapsedAbbrev: string;
  collapsedTitle: string;
  /** Optional first link inside the expanded group (e.g. Reports overview) */
  overview?: { href: string; label: string };
};

function pathMatchesItem(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupContainsPath(
  pathname: string,
  items: NavItem[],
  overviewHref?: string,
) {
  if (overviewHref && pathMatchesItem(pathname, overviewHref)) return true;
  return items.some((item) => pathMatchesItem(pathname, item.href));
}

function NavGroup(props: {
  config: NavGroupConfig;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { config, pathname, collapsed, open, onToggle } = props;
  const {
    label,
    items,
    collapsedHref,
    collapsedAbbrev,
    collapsedTitle,
    overview,
  } = config;

  if (collapsed) {
    return (
      <Link
        href={collapsedHref}
        className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 lg:px-2 lg:text-center"
        title={collapsedTitle}
      >
        <span className="lg:hidden">{label}</span>
        <span className="hidden lg:inline" aria-hidden>
          {collapsedAbbrev}
        </span>
      </Link>
    );
  }

  return (
    <div className="rounded-md border border-black/5 dark:border-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-left hover:bg-black/5 dark:hover:bg-white/5"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="text-xs opacity-70 tabular-nums" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-0.5 border-t border-black/5 dark:border-white/5 px-1 pb-1 pt-0.5">
          {overview ? (
            <Link
              href={overview.href}
              className={[
                "rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5",
                pathname === overview.href ? "bg-black/5 dark:bg-white/10" : "",
              ].join(" ")}
            >
              {overview.label}
            </Link>
          ) : null}
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5",
                pathMatchesItem(pathname, item.href)
                  ? "bg-black/5 dark:bg-white/10"
                  : "",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar(props: {
  brand: string;
  department?: string | null;
  subtitle: string;
  dashboardNav: NavItem[];
  setupNav: NavItem[];
  operationsNav: NavItem[];
  reportNav?: NavItem[];
}) {
  const {
    brand,
    department,
    subtitle,
    dashboardNav,
    setupNav,
    operationsNav,
    reportNav = [],
  } = props;
  const pathname = usePathname();
  const { status, session } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [perm, setPerm] = React.useState<Record<string, boolean> | null>(null);

  React.useEffect(() => {
    if (status !== "ready") return;
    if (!session?.role) return;
    let alive = true;
    setPerm(null);
    void getRolePermissionsAction(session.role as UserRole).then((m) => {
      if (!alive) return;
      setPerm(m as unknown as Record<string, boolean>);
    });
    return () => {
      alive = false;
    };
  }, [status, session?.role]);

  function canRoute(href: string): boolean {
    // If permissions haven't loaded yet, keep nav visible to avoid confusing blank sidebar.
    if (!perm) return true;
    const keys = PERMISSION_KEYS as readonly string[];
    const key = `route:${href}`;
    if (keys.includes(key)) return Boolean(perm[key]);
    // Fallback: allow by default for unknown routes.
    return true;
  }

  const filteredSetupNav = React.useMemo(
    () => setupNav.filter((i) => canRoute(i.href)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setupNav, perm],
  );
  const filteredOpsNav = React.useMemo(
    () => operationsNav.filter((i) => canRoute(i.href)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operationsNav, perm],
  );
  const filteredReportNav = React.useMemo(
    () => reportNav.filter((i) => canRoute(i.href)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportNav, perm],
  );

  const setupGroup: NavGroupConfig = React.useMemo(
    () => ({
      id: "setup",
      label: "Settings",
      items: filteredSetupNav,
      collapsedHref: "/setup",
      collapsedAbbrev: "SU",
      collapsedTitle:
        "Setup — company, users, customers, financial years, sales points, tax, products",
    }),
    [filteredSetupNav],
  );

  const operationsGroup: NavGroupConfig = React.useMemo(
    () => ({
      id: "operations",
      label: "Operations",
      items: filteredOpsNav,
      collapsedHref: "/delivery-orders",
      collapsedAbbrev: "OP",
      collapsedTitle: "Operations — delivery orders, sales",
    }),
    [filteredOpsNav],
  );

  const reportsGroup: NavGroupConfig | null = React.useMemo(() => {
    if (filteredReportNav.length === 0) return null;
    return {
      id: "reports",
      label: "Reports",
      items: filteredReportNav,
      collapsedHref: "/reports",
      collapsedAbbrev: "RP",
      collapsedTitle: "Reports — printable lists",
      overview: { href: "/reports", label: "Overview" },
    };
  }, [filteredReportNav]);

  const navGroups = React.useMemo(
    () =>
      [setupGroup, operationsGroup, reportsGroup].filter(
        (group) => group != null,
      ),
    [operationsGroup, reportsGroup, setupGroup],
  );

  const groupIdForPath = React.useCallback(
    (path: string) =>
      navGroups.find((group) =>
        groupContainsPath(path, group.items, group.overview?.href),
      )?.id ?? null,
    [navGroups],
  );

  const [openGroupId, setOpenGroupId] = React.useState<string | null>(() =>
    groupIdForPath(pathname),
  );

  React.useEffect(() => {
    setOpenGroupId(groupIdForPath(pathname));
  }, [groupIdForPath, pathname]);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar_collapsed") === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <aside
      className={[
        "rounded-2xl border border-black/10 dark:border-white/10 p-3 h-full flex flex-col",
        "transition-[width] duration-200",
        collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={collapsed ? "hidden lg:block" : ""}>
          <div className="font-semibold leading-tight">{brand}</div>
          {department ? (
            <div className="text-[11px] opacity-70 mt-0.5 leading-snug">
              {department}
            </div>
          ) : null}
          <div className="text-xs opacity-70 mt-1">{subtitle}</div>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="rounded-md border border-black/10 dark:border-white/10 px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="mt-3 flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
        {dashboardNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5",
              collapsed ? "lg:px-2 lg:text-center" : "",
              pathMatchesItem(pathname, item.href)
                ? "bg-black/5 dark:bg-white/10"
                : "",
            ].join(" ")}
            title={collapsed ? item.label : undefined}
          >
            <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            <span
              className={collapsed ? "hidden lg:inline" : "hidden"}
              aria-hidden
            >
              {item.label.slice(0, 2).toUpperCase()}
            </span>
          </Link>
        ))}

        <NavGroup
          config={setupGroup}
          pathname={pathname}
          collapsed={collapsed}
          open={openGroupId === setupGroup.id}
          onToggle={() =>
            setOpenGroupId((current) =>
              current === setupGroup.id ? null : setupGroup.id,
            )
          }
        />
        <NavGroup
          config={operationsGroup}
          pathname={pathname}
          collapsed={collapsed}
          open={openGroupId === operationsGroup.id}
          onToggle={() =>
            setOpenGroupId((current) =>
              current === operationsGroup.id ? null : operationsGroup.id,
            )
          }
        />
        {reportsGroup ? (
          <NavGroup
            config={reportsGroup}
            pathname={pathname}
            collapsed={collapsed}
            open={openGroupId === reportsGroup.id}
            onToggle={() =>
              setOpenGroupId((current) =>
                current === reportsGroup.id ? null : reportsGroup.id,
              )
            }
          />
        ) : null}
      </nav>

      <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
        {status === "ready" && session ? (
          <div
            className={[
              "text-xs opacity-80 space-y-1",
              collapsed ? "lg:hidden" : "",
            ].join(" ")}
          >
            <div className="font-medium truncate" title={session.displayName}>
              {session.displayName}
            </div>
            {session.service?.trim() ? (
              <div
                className="opacity-70 truncate text-[11px]"
                title={session.service}
              >
                {session.service}
              </div>
            ) : null}

            <div
              className="opacity-60 truncate text-[11px]"
              title={session.username}
            >
              @{session.username}
            </div>
            <div
              className="opacity-70 truncate"
              title={roleLabel(session.role)}
            >
              {roleLabel(session.role)}
            </div>
            {session.salesPoint ? (
              <div
                className="opacity-70 truncate"
                title={session.salesPoint.name}
              >
                {session.salesPoint.name}
              </div>
            ) : (
              <div className="opacity-70">All sales points</div>
            )}
            <div className="text-left w-full">
              <SignOutButton />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
