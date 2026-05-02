/** Bottom-right signature line for printed reports. */
export function ReportSignatory() {
  return (
    <div className="mt-16 flex justify-end print:mt-20 print:break-inside-avoid">
      <div className="w-56 text-center text-sm">
        <div
          className="min-h-10 w-full border-b border-black/50 dark:border-white/50"
          aria-hidden
        />
        <p className="mt-2 font-medium">Manager, Local Sales</p>
      </div>
    </div>
  );
}
