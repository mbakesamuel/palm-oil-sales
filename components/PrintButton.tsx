"use client";

export function PrintButton(props: { label?: string; className?: string }) {
  const { label = "Print", className } = props;
  return (
    <button
      type="button"
      className={
        className ??
        "rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25"
      }
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
