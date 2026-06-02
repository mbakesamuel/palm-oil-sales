"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import * as React from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#about", label: "About" },
] as const;

export function WelcomeHeroNav(props: {
  companyName: string;
  logoSrc: string;
}) {
  const { companyName, logoSrc } = props;
  const [open, setOpen] = React.useState(false);

  return (
    <header className="relative z-20 shrink-0">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            className="h-9 w-auto max-w-[72px] shrink-0 object-contain brightness-0 invert"
          />
          <span className="truncate text-sm font-bold uppercase tracking-wide sm:text-base">
            {companyName}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/login"
            className="rounded-full bg-brand-foreground px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-brand"
          >
            Sign in
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/10"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          className="border-t border-brand-foreground/15 bg-brand/35 px-4 py-3 backdrop-blur-md md:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-2">
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-2 text-sm font-semibold uppercase tracking-wider text-white/90 hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
