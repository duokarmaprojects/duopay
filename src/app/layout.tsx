import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DuoPay",
  description: "Split. Simplify. Get to ₹0.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ffffff", // Will adapt via CSS
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming on mobile inputs
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
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased min-h-screen flex flex-col transition-colors duration-200 ease-in-out`}>
        <ThemeProvider>
          <main className="flex-1 flex flex-col w-full max-w-md mx-auto bg-white shadow-sm min-h-screen overflow-x-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] relative transition-colors duration-200 ease-in-out">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
