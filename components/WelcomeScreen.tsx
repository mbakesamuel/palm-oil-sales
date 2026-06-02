import Link from "next/link";
import { WelcomeHeroNav } from "@/components/welcome/WelcomeHeroNav";
import { resolveCompanyLogoSrc } from "@/lib/company-logo";
import { getOrInitCompanySettings } from "@/lib/settings";

function WelcomeHeroBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--accent) 0%, var(--brand) 55%, #061208 100%)",
        }}
        aria-hidden
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <pattern id="welcome-contour" width="120" height="120" patternUnits="userSpaceOnUse">
            <path
              d="M0 60 Q30 20 60 60 T120 60"
              fill="none"
              stroke="var(--brand-foreground)"
              strokeWidth="0.6"
              opacity="0.5"
            />
            <path
              d="M0 90 Q40 50 80 90 T160 90"
              fill="none"
              stroke="var(--brand-foreground)"
              strokeWidth="0.5"
              opacity="0.35"
            />
          </pattern>
        </defs>
        <rect width="1200" height="800" fill="url(#welcome-contour)" />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[55%] w-full opacity-35"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="none"
          stroke="var(--brand-foreground)"
          strokeWidth="1"
          strokeDasharray="2 6"
          d="M0,280 C240,180 480,320 720,240 S1200,120 1440,200"
        />
        <path
          fill="none"
          stroke="var(--brand-foreground)"
          strokeWidth="0.8"
          strokeDasharray="1 5"
          opacity="0.7"
          d="M0,320 C300,220 600,360 900,280 S1300,200 1440,260"
        />
        {Array.from({ length: 48 }).map((_, i) => {
          const x = 30 + (i % 12) * 115;
          const y = 180 + Math.floor(i / 12) * 55 + (i % 3) * 12;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="1.2"
              fill="var(--brand-foreground)"
              opacity="0.55"
            />
          );
        })}
      </svg>
    </>
  );
}

export async function WelcomeScreen() {
  const settings = await getOrInitCompanySettings();
  const logoSrc = resolveCompanyLogoSrc(settings.logoUrl);
  const companyName = settings.companyName.trim();
  const department = settings.department?.trim();
  const subtitle = department ? `To ${department}` : `To ${companyName}`;

  return (
    <div className="welcome-hero relative flex h-full min-h-0 flex-col overflow-hidden text-brand-foreground">
      <WelcomeHeroBackground />

     {/*  <WelcomeHeroNav companyName={companyName} logoSrc={logoSrc} /> */}

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16 pt-4 text-center sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">Welcome</h1>
            <p className="text-xl font-medium text-brand-foreground/95 sm:text-2xl md:text-3xl">
              {subtitle}
            </p>
          </div>

          <p
            id="about"
            className="mx-auto max-w-lg text-sm leading-relaxed text-brand-foreground/85 sm:text-base"
          >
            Sales, inventory, delivery orders/shipping instructions, and operational reporting — sign in to
            manage your commercial line, working month, and daily sales activity.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex min-w-44 items-center justify-center rounded-full bg-brand-foreground px-8 py-3 text-sm font-bold uppercase tracking-[0.15em] text-brand shadow-lg transition hover:opacity-95 hover:shadow-xl"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
