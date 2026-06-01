"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { sessionRoleLabel } from "@/lib/auth-display";
import { PERMISSION_KEYS } from "@/lib/access-control-keys";
import { getPermissionsForSessionAction } from "@/app/(app)/setup/permissions/actions";
import { navIconForGroup, navIconForHref } from "@/lib/nav-icons";
import { SignOutButton } from "../forbidden/SignOutButton";

type NavItem = { href: string; label: string };

type NavSection = { sectionLabel: string; items: NavItem[] };

type NavGroupConfig = {
  id: string;
  label: string;
  items: NavItem[];
  /** When set (e.g. Reports), render labeled sub-sections instead of one flat list. */
  sections?: NavSection[];
  collapsedHref: string;
  collapsedTitle: string;
  overview?: { href: string; label: string };
};

/** Icon rail + lg collapsed: touch-friendly icon link */
const RAIL_LINK =
  "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md hover:bg-foreground/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring";

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
    sections,
    collapsedHref,
    collapsedTitle,
    overview,
    id,
  } = config;

  const groupIcon = navIconForGroup(id);
  const groupActive = groupContainsPath(pathname, items, overview?.href);

  return (
    <>
      <Link
        href={collapsedHref}
        className={[RAIL_LINK, groupActive ? "bg-brand/15" : "", "lg:hidden"].join(" ")}
        title={collapsedTitle}
        aria-label={collapsedTitle}
      >
        {React.createElement(groupIcon, {
          className: "size-5 shrink-0",
          "aria-hidden": true,
        })}
      </Link>

      <div className="hidden lg:block w-full">
        {collapsed ? (
          <Link
            href={collapsedHref}
            className={[RAIL_LINK, "w-full lg:py-2", groupActive ? "bg-brand/15" : ""].join(" ")}
            title={collapsedTitle}
            aria-label={collapsedTitle}
          >
            {React.createElement(groupIcon, {
              className: "size-5 shrink-0",
              "aria-hidden": true,
            })}
          </Link>
        ) : (
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={onToggle}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-left hover:bg-foreground/5"
              aria-expanded={open}
            >
              <span>{label}</span>
              <span className="text-xs opacity-70 tabular-nums" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>
            {open ? (
              <div className="flex flex-col gap-0.5 border-t border-border px-1 pb-1 pt-0.5">
                {overview ? (
                  <Link
                    href={overview.href}
                    className={[
                      "rounded-md px-3 py-1.5 text-sm hover:bg-foreground/5",
                      pathname === overview.href ? "bg-brand/15 font-medium" : "",
                    ].join(" ")}
                  >
                    {overview.label}
                  </Link>
                ) : null}
                {sections && sections.length > 0
                  ? sections.map((section) => (
                      <div key={section.sectionLabel} className="pt-1 first:pt-0">
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                          {section.sectionLabel}
                        </div>
                        {section.items.map((item) => {
                          const ItemIcon = navIconForHref(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={[
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-foreground/5",
                                pathMatchesItem(pathname, item.href)
                                  ? "bg-brand/15 font-medium"
                                  : "",
                              ].join(" ")}
                            >
                              <ItemIcon
                                className="size-4 shrink-0 opacity-80"
                                aria-hidden
                              />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ))
                  : items.map((item) => {
                      const ItemIcon = navIconForHref(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-foreground/5",
                            pathMatchesItem(pathname, item.href)
                              ? "bg-brand/15 font-medium"
                              : "",
                          ].join(" ")}
                        >
                          <ItemIcon className="size-4 shrink-0 opacity-80" aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

export function Sidebar(props: {
  brand: string;
  department?: string | null;
  logoSrc: string;
  subtitle: string;
  dashboardNav: NavItem[];
  setupNav: NavItem[];
  operationsNav: NavItem[];
  reportNav?: NavItem[];
  reportNavSections?: NavSection[];
}) {
  const {
    brand,
    department,
    logoSrc,
    subtitle,
    dashboardNav,
    setupNav,
    operationsNav,
    reportNav = [],
    reportNavSections,
  } = props;
  const pathname = usePathname();
  const { status, session } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [perm, setPerm] = React.useState<Record<string, boolean> | null>(null);

  React.useEffect(() => {
    if (status !== "ready") return;
    if (!session?.userId) return;
    let alive = true;
    setPerm(null);
    void getPermissionsForSessionAction()
      .then((m) => {
        if (!alive) return;
        setPerm(m as unknown as Record<string, boolean>);
      })
      .catch(() => {
        if (!alive) return;
        setPerm(null);
      });
    return () => {
      alive = false;
    };
  }, [
    status,
    session?.userId,
    session?.role,
    session?.commercialServiceRole?.id,
    session?.commercialService?.id,
  ]);

  function canRoute(href: string): boolean {
    if (!perm) return true;
    const keys = PERMISSION_KEYS as readonly string[];
    const key = `route:${href}`;
    if (keys.includes(key)) return Boolean(perm[key]);
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

  const filteredReportNavSections = React.useMemo(() => {
    if (!reportNavSections?.length) return undefined;
    return reportNavSections
      .map((section) => ({
        sectionLabel: section.sectionLabel,
        items: section.items.filter((i) => canRoute(i.href)),
      }))
      .filter((s) => s.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportNavSections, perm]);

  const setupGroup: NavGroupConfig = React.useMemo(
    () => ({
      id: "setup",
      label: "Settings",
      items: filteredSetupNav,
      collapsedHref: "/setup",
      collapsedTitle:
        "Settings — company, users, customers, financial years, sales points, tax, products",
    }),
    [filteredSetupNav],
  );

  const operationsGroup: NavGroupConfig = React.useMemo(
    () => ({
      id: "operations",
      label: "Operations",
      items: filteredOpsNav,
      collapsedHref: "/delivery-orders",
      collapsedTitle: "Operations — delivery orders and sales",
    }),
    [filteredOpsNav],
  );

  const reportsGroup: NavGroupConfig | null = React.useMemo(() => {
    if (filteredReportNav.length === 0) return null;
    return {
      id: "reports",
      label: "Reports",
      items: filteredReportNav,
      sections: filteredReportNavSections,
      collapsedHref: "/reports",
      collapsedTitle: "Reports — printable lists",
      overview: { href: "/reports", label: "Overview" },
    };
  }, [filteredReportNav, filteredReportNavSections]);

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

  const widthLg = collapsed ? "lg:w-20" : "lg:w-[300px]";

  return (
    <aside
      className={[
        "rounded-2xl border border-border bg-sidebar text-sidebar-foreground p-3 flex transition-[width] duration-200",
        "max-md:flex-row max-md:items-stretch max-md:gap-2 max-md:min-h-13",
        "md:h-full md:max-h-full md:flex-col md:gap-0",
        "w-full md:w-20 md:max-w-20 lg:max-w-none",
        widthLg,
      ].join(" ")}
    >
      <div
        className={[
          "hidden lg:flex flex-col gap-1.5 shrink-0",
          collapsed ? "lg:items-center lg:w-full" : "",
        ].join(" ")}
      >
        <div className="flex w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- settings may point to /public or http(s) URLs */}
          <img
            src={logoSrc}
            alt=""
            className="h-6 max-h-6 w-auto max-w-[72px] shrink-0 object-contain"
          />
        </div>
        {!collapsed ? (
          <div className="hidden lg:block min-w-0 w-full">
            <div className="text-sm font-semibold leading-tight truncate">{brand}</div>
            {department ? (
              <div className="text-[11px] opacity-70 mt-0.5 leading-snug truncate">
                {department}
              </div>
            ) : null}
            <div className="text-xs opacity-70 mt-1 truncate">{subtitle}</div>
          </div>
        ) : null}
      </div>

      <nav
        className={[
          "flex gap-1 flex-1 min-h-0",
          "max-md:flex-row max-md:overflow-x-auto max-md:overflow-y-hidden max-md:min-w-0 max-md:py-0.5",
          "md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pr-1 lg:mt-3",
        ].join(" ")}
      >
        {dashboardNav.map((item) => {
          const Icon = navIconForHref(item.href);
          const active = pathMatchesItem(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={[
                RAIL_LINK,
                "max-lg:min-w-11",
                "lg:min-h-0 lg:w-full lg:justify-start lg:rounded-md lg:px-3 lg:py-2 lg:text-sm lg:hover:bg-foreground/5",
                collapsed ? "lg:justify-center lg:px-2" : "",
                active ? "bg-brand/15 font-medium" : "",
              ].join(" ")}
            >
              <Icon
                className={[
                  "size-5 shrink-0",
                  "max-lg:block",
                  collapsed ? "lg:block" : "lg:hidden",
                ].join(" ")}
                aria-hidden
              />
              {!collapsed ? (
                <span className="hidden lg:inline truncate">{item.label}</span>
              ) : null}
            </Link>
          );
        })}

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

      <div
        className={[
          "mt-3 pt-3 border-t border-border shrink-0 flex gap-1",
          "max-md:flex-row max-md:mt-0 max-md:pt-0 max-md:border-t-0 max-md:border-l max-md:border-border max-md:pl-2 max-md:items-center",
          "md:flex-col md:mt-3 md:pt-3 md:border-t md:border-l-0 md:pl-0",
        ].join(" ")}
      >
        {status === "ready" && session ? (
          <>
            <div
              className="flex flex-row gap-1 items-center shrink-0 lg:hidden"
              title={`${session.displayName} · ${sessionRoleLabel(session)}`}
            >
              <div className={[RAIL_LINK, "border border-transparent"].join(" ")} aria-hidden>
                <UserRound className="size-5 shrink-0 opacity-90" />
              </div>
              <SignOutButton variant="icon" />
            </div>

            <div
              className={[
                "hidden lg:block text-xs opacity-80 space-y-1",
                collapsed ? "lg:hidden" : "",
              ].join(" ")}
            >
              <div className="font-medium truncate" title={session.displayName}>
                {session.displayName}
              </div>
              {(session.commercialService?.name?.trim() || session.service?.trim()) ? (
                <div
                  className="opacity-70 truncate text-[11px]"
                  title={
                    session.commercialService?.name?.trim()
                      ? `${session.commercialService.name} (${session.commercialService.invoicePrefix})`
                      : (session.service ?? "")
                  }
                >
                  {session.commercialService?.name?.trim()
                    ? session.commercialService.name
                    : session.service}
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
                title={sessionRoleLabel(session)}
              >
                {sessionRoleLabel(session)}
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
              <div className="text-left w-full pt-1">
                <SignOutButton />
              </div>
            </div>

            {collapsed ? (
              <div className="hidden lg:flex lg:justify-center lg:pt-1">
                <SignOutButton variant="icon" />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="hidden lg:flex shrink-0 justify-end pt-2">
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-foreground/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5 shrink-0" aria-hidden />
          ) : (
            <PanelLeftClose className="size-5 shrink-0" aria-hidden />
          )}
        </button>
      </div>
    </aside>
  );
}
