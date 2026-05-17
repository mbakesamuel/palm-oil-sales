import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { getServerSession } from "@/lib/auth-server";
import { getDefaultCommercialInvoicePrefix } from "@/lib/commercial-service";
import { getOrInitCompanySettings } from "@/lib/settings";
import { uiThemePresetToDataAttribute } from "@/lib/ui-theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getOrInitCompanySettings();
    const title =
      s.department != null && s.department.trim() !== ""
        ? `${s.companyName} · ${s.department.trim()}`
        : s.companyName;
    return {
      title: `${title} (PO)`,
      description: "Palm oil sales, inventory, and cashier reporting.",
    };
  } catch {
    return {
      title: "Palm Oil Sales (PO)",
      description: "Palm oil sales, inventory, and cashier reporting.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devby = "ISD";
  let footerLine = "Currency: XAF · VAT: 19.25% · Invoice prefix: PO";
  let uiTheme = uiThemePresetToDataAttribute(undefined);
  try {
    const [s, defaultInvoicePrefix, session] = await Promise.all([
      getOrInitCompanySettings(),
      getDefaultCommercialInvoicePrefix(),
      getServerSession(),
    ]);
    uiTheme = uiThemePresetToDataAttribute(s.uiThemePreset);
    const vatPct = (Number.parseFloat(String(s.vatRate)) * 100).toFixed(2);
    const dept = s.department?.trim() || null;
    const serviceName = session?.commercialService?.name?.trim() || null;
    const invoicePrefix =
      session?.commercialService?.invoicePrefix?.trim() || defaultInvoicePrefix;
    footerLine = [
      dept,
      serviceName,
      `Currency: XAF`,
      `VAT: ${vatPct}%`,
      `Invoice prefix: ${invoicePrefix}`,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    /* build without DB */
  }

  return (
    <html lang="en" className="h-full antialiased" data-ui-theme={uiTheme}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border print:hidden">
            <div className="flex flex-row justify-between items-center">
              <div className="mx-auto w-full max-w-5xl px-4 py-3 text-xs opacity-70">
                {footerLine}
              </div>
              <div className="text-xs opacity-70 px-4">
                Developed by: {devby} 2026
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
