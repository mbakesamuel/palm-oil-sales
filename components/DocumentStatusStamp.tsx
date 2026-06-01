"use client";

/** Diagonal watermark for draft / pending printable documents. */
export function DocumentStatusStamp(props: { label: string }) {
  const { label } = props;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center select-none"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <span
        className="font-extrabold uppercase tracking-[0.18em] text-red-600 border-8 border-red-600 rounded-md px-8 py-3"
        style={{
          transform: "rotate(-18deg)",
          fontSize: "clamp(48px, 9vw, 110px)",
          opacity: 0.32,
          letterSpacing: "0.18em",
          boxShadow: "inset 0 0 0 2px rgba(220,38,38,0.15)",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        {label}
      </span>
    </div>
  );
}
