"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { messages } from "@/messages";

/** The landing page's menu for narrow screens: sign in, create an account and the theme. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
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
        <div className="flex flex-col gap-3 px-4 pb-6">
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
          <div className="border-t border-line pt-4">
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
