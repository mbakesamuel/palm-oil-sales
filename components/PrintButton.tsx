"use client";

export function PrintButton(props: { label?: string; className?: string }) {
  const { label = "Print", className } = props;
  return (
    <button
      type="button"
      className={
        className ??
        "rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
      }
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
