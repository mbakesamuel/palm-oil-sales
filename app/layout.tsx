import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
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
  let uiTheme = uiThemePresetToDataAttribute(undefined);
  try {
    const s = await getOrInitCompanySettings();
    uiTheme = uiThemePresetToDataAttribute(s.uiThemePreset);
  } catch {
    /* build without DB */
  }

  return (
    <html lang="en" className="h-full overflow-hidden antialiased" data-ui-theme={uiTheme}>
      <body className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <AuthProvider>
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
