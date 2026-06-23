export function WelcomeHeroBackground() {
  return (
    <div className="welcome-hero-bg absolute inset-0 z-0" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- static file from /public */}
      <img
        src="/welcome/3.jpg"
        alt=""
        className="welcome-hero-bg__photo"
        decoding="async"
        fetchPriority="high"
      />
      <div className="welcome-hero-bg__overlay" />
    </div>
  );
}
