"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/auth-display";

type NavItem = { href: string; label: string };

export function Sidebar(props: {
  nav: NavItem[];
  reportNav?: NavItem[];
  brand: string;
  department?: string | null;
  subtitle: string;
}) {
  const { nav, reportNav = [], brand, department, subtitle } = props;
  const router = useRouter();
  const pathname = usePathname();
  const { status, session, signOut } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [reportsOpen, setReportsOpen] = React.useState(true);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar_collapsed") === "1");
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem("sidebar_reports_open");
      if (v === "0" || v === "1") setReportsOpen(v === "1");
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (reportNav.length > 0 && pathname.startsWith("/reports")) {
      setReportsOpen(true);
    }
  }, [pathname, reportNav.length]);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  function toggleReports() {
    setReportsOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("sidebar_reports_open", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <aside
      className={[
        "rounded-2xl border border-black/10 dark:border-white/10 p-3 h-fit",
        "transition-[width] duration-200",
        collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={collapsed ? "hidden lg:block" : ""}>
          <div className="font-semibold leading-tight">{brand}</div>
          {department ? (
            <div className="text-[11px] opacity-70 mt-0.5 leading-snug">{department}</div>
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

      <nav className="mt-3 flex flex-col gap-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5",
              collapsed ? "lg:px-2 lg:text-center" : "",
            ].join(" ")}
            title={collapsed ? item.label : undefined}
          >
            <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            <span className={collapsed ? "hidden lg:inline" : "hidden"} aria-hidden>
              {item.label.slice(0, 2).toUpperCase()}
            </span>
          </Link>
        ))}

        {reportNav.length > 0 ? (
          collapsed ? (
            <Link
              href="/reports"
              className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 lg:px-2 lg:text-center"
              title="Reports"
            >
              <span className="lg:hidden">Reports</span>
              <span className="hidden lg:inline" aria-hidden>
                RP
              </span>
            </Link>
          ) : (
            <div className="rounded-md border border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={toggleReports}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-left hover:bg-black/5 dark:hover:bg-white/5"
                aria-expanded={reportsOpen}
              >
                <span>Reports</span>
                <span className="text-xs opacity-70 tabular-nums" aria-hidden>
                  {reportsOpen ? "−" : "+"}
                </span>
              </button>
              {reportsOpen ? (
                <div className="flex flex-col gap-0.5 border-t border-black/5 dark:border-white/5 px-1 pb-1 pt-0.5">
                  <Link
                    href="/reports"
                    className={[
                      "rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5",
                      pathname === "/reports" ? "bg-black/5 dark:bg-white/10" : "",
                    ].join(" ")}
                  >
                    Overview
                  </Link>
                  {reportNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5",
                        pathname === item.href ? "bg-black/5 dark:bg-white/10" : "",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )
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
            <div className="font-medium truncate" title={session.username}>
              {session.username}
            </div>
            <div className="opacity-70 truncate" title={roleLabel(session.role)}>
              {roleLabel(session.role)}
            </div>
            {session.salesPoint ? (
              <div className="opacity-70 truncate" title={session.salesPoint.name}>
                {session.salesPoint.name}
              </div>
            ) : (
              <div className="opacity-70">All sales points</div>
            )}
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/login");
              }}
              className="text-left w-full text-xs underline underline-offset-4 hover:opacity-100"
            >
              Sign out
            </button>
          </div>
        ) : null}
        <Link
          href="/"
          className={[
            "text-sm underline underline-offset-4 opacity-80",
            collapsed ? "lg:hidden" : "",
          ].join(" ")}
        >
          Back to welcome
        </Link>
        <Link
          href="/"
          className={[
            "hidden lg:inline text-xs underline underline-offset-4 opacity-80",
            collapsed ? "" : "lg:hidden",
          ].join(" ")}
          title="Back to welcome"
        >
          Back
        </Link>
      </div>
    </aside>
  );
}

