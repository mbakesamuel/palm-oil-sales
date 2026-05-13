import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import { saveCompanySettings } from "@/app/(app)/setup/actions";
import { fiscalPeriodForDate, formatFinancialYearLabel, monthName } from "@/lib/fiscal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SetupPage() {
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();
  const today = new Date();
  const currentFy = fiscalPeriodForDate(today, settings.fiscalYearStartMonth);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, name: true, role: true, service: true },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="text-sm opacity-75">
          Configure your company info, department, VAT rate, invoice prefix, financial year, and optional agro-themed
          appearance.
        </p>
      </div>

      <form action={saveCompanySettings} className="space-y-4 max-w-xl">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="companyName">
            Company name
          </label>
          <input
            id="companyName"
            name="companyName"
            defaultValue={settings.companyName}
            className="rounded-md border border-border bg-transparent px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="logoUrl">
            Logo URL (optional)
          </label>
          <input
            id="logoUrl"
            name="logoUrl"
            defaultValue={settings.logoUrl ?? ""}
            placeholder="e.g. /cdc-logo-svg.svg or https://…"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
          <div className="text-xs opacity-70">
            Use a path to a file in <span className="font-mono">public</span> (starts with{" "}
            <span className="font-mono">/</span>) or a direct image URL. Leave blank for text only.
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="department">
            Department (optional)
          </label>
          <input
            id="department"
            name="department"
            defaultValue={settings.department ?? ""}
            placeholder="e.g. Commercial department"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
          <div className="text-xs opacity-70">
            Shown in the app shell, delivery order PDFs, and confirm dialogs (e.g. division or unit name).
            {" "}
            Optional <span className="font-medium">service</span> lines (e.g. retail counter) are{" "}
            <span className="font-medium">per user</span> and edited under{" "}
            <a className="underline underline-offset-4" href="/users">
              Users
            </a>
            ; department stays company-wide.
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="phone">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={settings.phone ?? ""}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="address">
            Address (optional)
          </label>
          <input
            id="address"
            name="address"
            defaultValue={settings.address ?? ""}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="vatRate">
            VAT rate (decimal)
          </label>
          <input
            id="vatRate"
            name="vatRate"
            defaultValue={String(settings.vatRate)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
            inputMode="decimal"
            required
          />
          <div className="text-xs opacity-70">Use `0.1925` for 19.25%.</div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="invoicePrefix">
            Invoice prefix
          </label>
          <input
            id="invoicePrefix"
            name="invoicePrefix"
            defaultValue={settings.invoicePrefix}
            className="rounded-md border border-border bg-transparent px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="fiscalYearStartMonth">
            Financial year starts in
          </label>
          <select
            id="fiscalYearStartMonth"
            name="fiscalYearStartMonth"
            defaultValue={String(settings.fiscalYearStartMonth)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
            required
          >
            {Array.from({ length: 12 }, (_, i) => {
              const m = i + 1;
              return (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              );
            })}
          </select>
          <div className="text-xs opacity-70">
            Month <span className="font-medium">1</span> of the financial year begins on the first day of this calendar
            month. Choose January if your financial year matches the calendar year.
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="uiThemePreset">
            Appearance (theme)
          </label>
          <select
            id="uiThemePreset"
            name="uiThemePreset"
            defaultValue={settings.uiThemePreset}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          >
            <option value="default">Neutral (default)</option>
            <option value="agro">Agro — green and yellow</option>
          </select>
          <div className="text-xs opacity-70">
            Company-wide look for the web app. Users see the change after save (or on next visit).
          </div>
        </div>

        <div className="rounded-lg border border-border bg-accent/30 px-4 py-3 text-sm space-y-1">
          <div className="font-medium">Today’s fiscal period (preview, from start month)</div>
          <p className="opacity-90">
            FY <span className="font-semibold tabular-nums">{formatFinancialYearLabel(currentFy.financialYear, settings.fiscalYearStartMonth)}</span>
            {" · "}
            Fiscal month{" "}
            <span className="font-semibold tabular-nums">
              {currentFy.financialMonth}
            </span>
            /12
          </p>
          <p className="text-xs opacity-75">
            Posting uses explicit financial year dates and calendar working months under{" "}
            <a className="underline underline-offset-4" href="/financial-years">
              Financial years
            </a>
            .
          </p>
        </div>

        <button className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium">
          Save settings
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">User accounts</h2>
        <p className="text-sm opacity-75">
          Administrators manage usernames, passwords, roles, sales points, and optional per-user service under{" "}
          <a className="underline underline-offset-4" href="/users">
            Users
          </a>
          . Saving settings here with no users yet will create default accounts{" "}
          <span className="font-mono text-xs">admin</span> /{" "}
          <span className="font-mono text-xs">admin</span> and{" "}
          <span className="font-mono text-xs">clerk</span> /{" "}
          <span className="font-mono text-xs">clerk</span> (clerk is tied to the first sales point if
          one exists).
        </p>
        <div className="rounded-lg border border-border p-4">
          {users.length === 0 ? (
            <div className="text-sm opacity-75">
              No users yet. Saving settings will create default Admin and Clerk users.
            </div>
          ) : (
            <ul className="text-sm space-y-1">
              {users.map((u) => (
                <li key={u.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <span>
                      <span className="font-mono text-xs opacity-80">{u.username}</span>
                      <span className="mx-1 opacity-40">·</span>
                      {u.name}
                    </span>
                    {u.service?.trim() ? (
                      <div className="text-xs opacity-70 truncate" title={u.service}>
                        Service: {u.service}
                      </div>
                    ) : null}
                  </div>
                  <span className="opacity-70 shrink-0">{u.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

