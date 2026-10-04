import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

import { PwaProvider } from "@/components/pwa/PwaProvider";
import { ConnectivityIndicator } from "@/components/offline/ConnectivityIndicator";
import { NativePushManager } from "@/components/notifications/NativePushManager";
import { BiometricLockProvider } from "@/components/biometric/BiometricLockProvider";
import { auth } from "@/lib/auth";

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
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

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
      <body className={`${inter.className} bg-[#09090b] text-zinc-100 antialiased min-h-[100dvh] flex flex-col selection:bg-zinc-800 selection:text-white`}>
        <ThemeProvider>
          <PwaProvider>
            <BiometricLockProvider userId={session?.user?.id}>
              <NativePushManager />
              <ConnectivityIndicator />
              <main className="flex-1 flex flex-col w-full max-w-md mx-auto bg-[#09090b] min-h-[100dvh] relative overflow-x-clip pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
                {children}
              </main>
            </BiometricLockProvider>
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
