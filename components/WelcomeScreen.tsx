import Link from "next/link";
import { WelcomeHeroBackground } from "@/components/welcome/WelcomeHeroBackground";

export function WelcomeScreen(props: { companyName: string; logoSrc: string }) {
  const { companyName, logoSrc } = props;
  const displayName = companyName.trim() || "Sales Management";

  return (
    <div className="welcome-hero relative min-h-dvh w-full overflow-hidden text-foreground">
      {/*  <WelcomeHeroBackground /> */}

      <header className="absolute left-0 top-0 z-20 flex items-center gap-3 px-6 py-6 sm:px-10 sm:py-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG from /public */}
        <img
          src={logoSrc}
          alt=""
          className="h-9 max-h-9 w-auto max-w-[80px] object-contain"
        />
        <span className="text-sm font-semibold tracking-wide text-brand sm:text-base">
          {displayName}
        </span>
      </header>

      <p className="absolute bottom-0 right-0 z-20 px-6 py-6 text-right text-xs font-medium italic text-foreground/80 sm:px-10 sm:py-8 sm:text-sm">
        At the service of the nation since 1947
      </p>

      <main className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center px-4 pb-16 pt-24 text-center sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-brand/5 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- static files from /public */}
              <img
                src="/welcome/3.jpg"
                alt="Palm oil operations"
                className="h-full w-full object-contain"
              />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- static files from /public */}
            <img
              src="/welcome/4.webp"
              alt="Sales and agriculture"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="space-y-4">
            <h1 className="text-lg font-bold uppercase text-foreground sm:text-5xl md:text-4xl whitespace-nowrap">
              Sales Management Application
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base md:text-lg">
              (Manage sales operations from one platform.)
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-brand px-10 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-brand-foreground shadow-md transition hover:opacity-95"
            >
              Sign in
            </Link>
          </div>

          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-20 px-6 py-6 text-center text-md font-medium italic text-foreground/80 sm:px-10 sm:py-8 sm:text-md">
            <p>one platform, one vision... stronger sales, together.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
