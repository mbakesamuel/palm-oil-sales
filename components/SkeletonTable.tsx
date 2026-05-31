import type { ReactNode } from "react";

type SkeletonTableColumn = {
  label: ReactNode;
  className?: string;
  /** Skeleton bar width in the last column (actions), use `narrow` for short controls */
  skeleton?: "default" | "narrow" | "wide";
};

export function SkeletonTable(props: {
  columns: SkeletonTableColumn[];
  rowCount?: number;
  emptyMessage?: string;
  caption?: ReactNode;
}) {
  const { columns, rowCount = 5, emptyMessage, caption } = props;

  function skeletonWidth(col: SkeletonTableColumn, colIndex: number) {
    if (col.skeleton === "narrow") return "w-16";
    if (col.skeleton === "wide") return "w-3/4";
    if (colIndex === columns.length - 1) return "w-20 ml-auto";
    return "w-[70%]";
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={["p-2 font-medium", col.className].filter(Boolean).join(" ")}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border align-top">
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={[
                      "p-2",
                      col.className?.includes("text-right") ? "text-right" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div
                      className={[
                        "h-4 rounded-md bg-accent/50 animate-pulse",
                        skeletonWidth(col, colIdx),
                      ].join(" ")}
                      aria-hidden
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {emptyMessage ? (
        <p className="text-sm opacity-75">{emptyMessage}</p>
      ) : null}
      {caption}
    </div>
  );
}
