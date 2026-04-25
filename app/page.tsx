
export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="opacity-80">
        Start a sale in POS, manage customers, and configure VAT/invoice settings.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="/pos"
          className="rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="font-medium">POS</div>
          <div className="text-sm opacity-75">Create a sale (cash/cheque).</div>
        </a>
        <a
          href="/customers"
          className="rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="font-medium">Customers</div>
          <div className="text-sm opacity-75">Tax regime & taxpayer ID.</div>
        </a>
        <a
          href="/setup"
          className="rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="font-medium">Setup</div>
          <div className="text-sm opacity-75">Company, VAT rate, invoice prefix.</div>
        </a>
      </div>
    </div>
  );
}
