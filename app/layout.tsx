import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { getOrInitCompanySettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  let footerLine = "Currency: XAF · VAT: 19.25% · Invoice prefix: PO";
  try {
    const s = await getOrInitCompanySettings();
    const vatPct = (Number.parseFloat(String(s.vatRate)) * 100).toFixed(2);
    const dept = s.department?.trim();
    footerLine = [
      s.companyName,
      dept ? dept : null,
      `Currency: XAF`,
      `VAT: ${vatPct}%`,
      `Invoice prefix: ${s.invoicePrefix}`,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    /* build without DB */
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-black/10 dark:border-white/10 print:hidden">
            <div className="mx-auto w-full max-w-5xl px-4 py-3 text-xs opacity-70">{footerLine}</div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
