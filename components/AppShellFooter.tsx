export function AppShellFooter(props: { line: string }) {
  return (
    <footer className="border-t border-border print:hidden">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0 flex-1 px-4 py-3 text-xs opacity-70 sm:px-6">
          {props.line}
        </div>
        <div className="shrink-0 whitespace-nowrap px-4 text-xs opacity-70 sm:px-6">
          ISD 2026
        </div>
      </div>
    </footer>
  );
}
