import { Show, SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AccountRole } from "@/components/account-role";
import { Button } from "@/components/ui/button";

/** Minimal header with account controls; the full role-aware shell arrives in 13.08. */
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Solar Lanka
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Show when="signed-out">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Create account</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild variant="ghost">
              <Link href="/account">Account</Link>
            </Button>
            <SignOutButton>
              <Button variant="outline">Sign out</Button>
            </SignOutButton>
            <AccountRole />
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}
