import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Logo, LogoMark } from "@/components/brand/logo";
import { AccountRole } from "@/components/account-role";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { AccountLinks, PrimaryNav } from "@/components/shell/primary-nav";
import { StickyHeader } from "@/components/shell/sticky-header";
import { ThemeControl } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth/server";
import { messages } from "@/messages";

/** Application header. */
export async function SiteHeader() {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <>
      <StickyHeader>
        <div data-header-bar className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
          <MobileMenu signedIn={isSignedIn} />
          <Link href="/" className="inline-flex min-h-11 items-center rounded-field text-ink" data-brand-link>
            <Logo height={30} className="hidden sm:block" />
            <LogoMark size={36} className="sm:hidden" title={messages.app.name} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <ThemeControl />
            </div>
            {isSignedIn ? (
              <>
                <AccountRole />
                <AccountLinks signedIn />
                <SignOutButton>
                  <Button variant="outline" className="hidden md:inline-flex">
                    {messages.auth.signOut}
                  </Button>
                </SignOutButton>
                <UserButton />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden md:inline-flex">
                  <Link href="/sign-in">{messages.auth.signIn}</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">{messages.auth.createAccount}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </StickyHeader>
      <PrimaryNav signedIn={isSignedIn} />
    </>
  );
}
