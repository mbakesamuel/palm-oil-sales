import type { ReactNode } from "react";

export type EmptyTableColumn = {
  label: ReactNode;
  className?: string;
};

/** Bordered table with headers and a single empty-state row in the body. */
export function EmptyTableNotice(props: {
  columns: EmptyTableColumn[];
  children: ReactNode;
}) {
  const { columns, children } = props;
  return (
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
          <tr>
            <td
              colSpan={columns.length}
              className="p-10 text-center text-sm text-foreground/70"
            >
              {children}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
