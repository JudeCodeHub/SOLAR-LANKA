"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { NavLink } from "@/components/shell/nav-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNavigation } from "@/lib/api/use-shell-user";
import { messages } from "@/messages";

/** Navigation for narrow screens. */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const groups = useNavigation(signedIn);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="border-line md:hidden" aria-label={messages.nav.openMenu}>
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <Logo height={28} className="text-ink" />
          <SheetTitle className="type-caption pt-2 tracking-widest text-ink-3 uppercase">{messages.nav.menuTitle}</SheetTitle>
          <SheetDescription className="sr-only">{messages.nav.menuDescription}</SheetDescription>
        </SheetHeader>
        <nav aria-label={messages.nav.mobileLabel} className="flex flex-col gap-5 px-4 pb-6">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`menu-${group.id}`}>
              <h2
                id={`menu-${group.id}`}
                className="type-caption px-3 pb-1 font-semibold tracking-widest text-ink-3 uppercase"
              >
                {group.label}
              </h2>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavLink item={item} onNavigate={close} className="flex min-h-11 w-full rounded-lg" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <ThemeToggle />
            {signedIn ? (
              <SignOutButton>
                <Button variant="outline">{messages.auth.signOut}</Button>
              </SignOutButton>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href="/sign-in" onClick={close}>
                    {messages.auth.signIn}
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up" onClick={close}>
                    {messages.auth.createAccount}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
