import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ViewTransition } from "react";
import "./globals.css";
import { bodyFont, displayFont, figureFont } from "@/fonts/fonts";
import { ComparisonTray } from "@/components/comparison/comparison-tray";
import { Providers } from "@/components/providers";
import { SessionWatcher } from "@/components/session-watcher";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/shell/skip-link";
import { SiteHeader } from "@/components/site-header";
import { BRAND_COLOURS } from "@/lib/brand/logo";
import { THEME_SCRIPT } from "@/lib/theme/theme";
import { messages } from "@/messages";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: messages.app.name,
  description: messages.app.description,
  openGraph: { type: "website", siteName: messages.app.name, title: messages.app.name, description: messages.app.description },
  twitter: { card: "summary_large_image", title: messages.app.name, description: messages.app.description },
};

/** The browser bar follows the system theme. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_COLOURS.light.background },
    { media: "(prefers-color-scheme: dark)", color: BRAND_COLOURS.dark.background },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} ${figureFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <ClerkProvider
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <Providers>
            <SessionWatcher />
            <SkipLink />
            <SiteHeader />
            <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
              <ViewTransition default="page">{children}</ViewTransition>
            </main>
            <ComparisonTray />
            <SiteFooter />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
