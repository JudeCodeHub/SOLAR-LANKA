import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AccountRole } from "@/components/account-role";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { AccountLinks, PrimaryNav } from "@/components/shell/primary-nav";
import { Button } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth/server";

/**
 * Application header. Whether the visitor is signed in is known on the server, so the first
 * paint is already correct; the links that depend on role arrive with the user's profile.
 */
export async function SiteHeader() {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <MobileMenu signedIn={isSignedIn} />
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Solar Lanka
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {isSignedIn ? (
            <>
              <AccountRole />
              <AccountLinks signedIn />
              <SignOutButton>
                <Button variant="outline" className="hidden md:inline-flex">
                  Sign out
                </Button>
              </SignOutButton>
              <UserButton />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Create account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <PrimaryNav signedIn={isSignedIn} />
    </header>
  );
}
