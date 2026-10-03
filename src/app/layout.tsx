import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

import { PwaProvider } from "@/components/pwa/PwaProvider";
import OfflineIndicator from "@/components/offline/OfflineIndicator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DuoPay",
  description: "Split. Settle. Done.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DuoPay",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('duopay-theme') || 'system';
                if (theme === 'system') {
                  let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.classList.add(isDark ? 'dark' : 'light');
                } else {
                  document.documentElement.classList.add(theme);
                }
              } catch (e) {}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // DuoPay Security Notice: Browser is untrusted. All authorization, balances,
              // cryptographic tokens, and settlements are strictly enforced server-side.
              try {
                if (typeof window !== 'undefined') {
                  console.log('%cDuoPay Defense-in-Depth', 'color: #10b981; font-weight: bold; font-size: 14px;');
                  console.log('%cAll transactions, invites, and balances are cryptographically signed and verified server-side.', 'color: #71717a; font-size: 11px;');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 antialiased min-h-screen flex flex-col transition-colors duration-200 ease-in-out`}>
        <ThemeProvider>
          <PwaProvider>
            <OfflineIndicator />
            <main className="flex-1 flex flex-col w-full max-w-md mx-auto bg-white dark:bg-zinc-950 shadow-sm min-h-screen overflow-x-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] relative transition-colors duration-200 ease-in-out">
              {children}
            </main>
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
