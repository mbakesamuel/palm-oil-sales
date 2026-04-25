import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Palm Oil Sales (PO)",
  description: "Palm oil sales, inventory, and cashier reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto w-full max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="font-semibold">Palm Oil Sales</div>
            <nav className="text-sm flex items-center gap-3">
              <Link className="underline-offset-4 hover:underline" href="/">
                Dashboard
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/pos">
                POS
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/customers">
                Customers
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/tax-regimes">
                Regimes
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/products">
                Products
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/sales-points">
                Sales points
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/setup">
                Setup
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-black/10 dark:border-white/10">
          <div className="mx-auto w-full max-w-5xl px-4 py-3 text-xs opacity-70">
            Currency: XAF · VAT: 19.25% · Invoice prefix: PO
          </div>
        </footer>
      </body>
    </html>
  );
}
