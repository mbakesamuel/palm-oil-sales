export function AppShellFooter(props: { line: string }) {
  return (
    <footer className="border-t border-border print:hidden">
      <div className="flex flex-row items-center justify-between">
        <div className="w-full px-4 py-3 text-xs opacity-70 sm:px-6">
          {props.line}
        </div>
        <div className="px-4 text-xs opacity-70">ISD 2026</div>
      </div>
    </footer>
  );
}
