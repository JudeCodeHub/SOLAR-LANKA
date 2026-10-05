"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { NavLink } from "@/components/shell/nav-link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigation } from "@/lib/api/use-shell-user";
import type { NavGroupId } from "@/lib/navigation";
import { format, messages } from "@/messages";

const ROW = "flex min-h-11 w-full rounded-lg";

/** The frame for a signed-in area: its own links in a side column on desktop and a drawer on phones, with the current page marked. */
export function DashboardShell({ group, signedIn, children }: { group: NavGroupId; signedIn: boolean; children: ReactNode }) {
  const groups = useNavigation(signedIn);
  const [open, setOpen] = useState(false);
  const area = groups.find((candidate) => candidate.id === group);
  if (!area || area.items.length <= 1) {
    return <>{children}</>;
  }
  const label = format(messages.nav.areaLabel, { area: area.label });
  const links = (onNavigate?: () => void) => (
    <ul className="flex flex-col gap-1">
      {area.items.map((item) => (
        <li key={item.id}>
          <NavLink item={item} onNavigate={onNavigate} className={ROW} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mx-auto flex w-full max-w-wide flex-1 gap-8 px-4 sm:px-6" data-dashboard={group}>
      <aside className="hidden w-60 shrink-0 lg:block">
        <nav aria-label={label} className="sticky top-24 space-y-2 py-8">
          <p className="type-caption px-3 font-semibold tracking-widest text-ink-3 uppercase">{area.label}</p>
          {links()}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="pt-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu aria-hidden />
                {area.label}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{area.label}</SheetTitle>
                <SheetDescription className="sr-only">{messages.nav.menuDescription}</SheetDescription>
              </SheetHeader>
              <nav aria-label={label} className="px-4 pb-6">
                {links(() => setOpen(false))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </div>
    </div>
  );
}
