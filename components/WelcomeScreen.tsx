import Link from "next/link";
import { WelcomeHeroCarousel } from "@/components/welcome/WelcomeHeroCarousel";

export function WelcomeScreen() {
  return (
    <div className="welcome-hero relative min-h-dvh w-full overflow-hidden text-brand-foreground">
      <WelcomeHeroCarousel />

      <main className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center px-4 pb-16 pt-4 text-center sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 sm:px-8">
          <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand/90 p-5 shadow-lg backdrop-blur-sm">
            <h1 className="text-4xl font-bold tracking-tight text-accent drop-shadow-sm sm:text-5xl md:text-6xl">
              Sales Management App
            </h1>
            <p className="text-lg font-medium text-brand-foreground/95 drop-shadow-sm sm:text-xl md:text-2xl">
              One platform, one vision — stronger sales, together.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
            <span className="text-sm font-medium text-brand-foreground/90">
              Click here
            </span>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-8 py-3 text-sm font-bold tracking-wide text-accent-foreground shadow-md transition hover:opacity-95"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
