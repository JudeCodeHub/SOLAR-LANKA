import Link from "next/link";

import { Logo, LogoMark } from "@/components/brand/logo";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { StickyHeader } from "@/components/shell/sticky-header";
import { ThemeControl } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/** The landing page's top bar, for visitors who are not signed in (a signed-in person goes straight to the dashboard, which has its own sidebar and top strip). */
export function SiteHeader() {
  return (
    <StickyHeader>
      <div data-header-bar className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <MobileMenu />
        <Link href="/" className="inline-flex min-h-11 items-center rounded-field text-ink" data-brand-link>
          <Logo height={30} className="hidden sm:block" />
          <LogoMark size={36} className="sm:hidden" title={messages.app.name} />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <ThemeControl />
          </div>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/sign-in">{messages.auth.signIn}</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">{messages.auth.createAccount}</Link>
          </Button>
        </div>
      </div>
    </StickyHeader>
  );
}
