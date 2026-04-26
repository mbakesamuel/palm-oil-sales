"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/auth-display";

type NavItem = { href: string; label: string };

export function Sidebar(props: {
  nav: NavItem[];
  brand: string;
  department?: string | null;
  subtitle: string;
}) {
  const { nav, brand, department, subtitle } = props;
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [collapsed, setCollapsed] = React.useState(() => {
    // Initialize from localStorage without an effect (eslint rule).
    try {
      return localStorage.getItem("sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });

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
      </nav>

      <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
        {session ? (
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

