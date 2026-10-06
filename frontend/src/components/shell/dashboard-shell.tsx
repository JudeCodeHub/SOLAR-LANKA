"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { NAV_ICONS } from "@/components/shell/nav-icons";
import { NavLink } from "@/components/shell/nav-link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigation } from "@/lib/api/use-shell-user";
import type { NavGroup, NavGroupId } from "@/lib/navigation";
import { format, messages } from "@/messages";

const ROW = "flex min-h-11 w-full rounded-[0.75rem] aria-[current=page]:shadow-[inset_3px_0_0_var(--ds-orange-text)]";

/** The frame for a signed-in area: its own links in a side column on desktop and a drawer on phones, with the current page marked. */
export function DashboardShell({ group, signedIn, children }: { group: NavGroupId; signedIn: boolean; children: ReactNode }) {
  const groups = useNavigation(signedIn);
  const area = groups.find((candidate) => candidate.id === group);
  if (!area || area.items.length <= 1) {
    return <>{children}</>;
  }
  return <DashboardFrame area={area} group={group}>{children}</DashboardFrame>;
}

/** The side column, the phone drawer and the page beside them; `current` stands in for the address in a sample. */
export function DashboardFrame({ area, group, current, children }: { area: NavGroup; group: NavGroupId; current?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const label = format(messages.nav.areaLabel, { area: area.label });
  const links = (onNavigate?: () => void) => (
    <ul className="flex flex-col gap-1">
      {area.items.map((item) => {
        const Icon = NAV_ICONS[item.id];
        return (
          <li key={item.id}>
            <NavLink item={item} onNavigate={onNavigate} pathname={current} exact={area.items.some((other) => other.href.startsWith(`${item.href}/`))} icon={Icon ? <Icon aria-hidden className="size-[1.125rem] shrink-0" /> : null} className={ROW} />
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="mx-auto flex w-full max-w-wide flex-1 gap-8 px-4 sm:px-6" data-dashboard={group}>
      <aside className="hidden w-60 shrink-0 lg:block">
        <nav aria-label={label} className="sticky top-40 space-y-3 py-8">
          <p className="type-caption px-3 font-semibold tracking-widest text-ink-3 uppercase">{area.label}</p>
          <div className="rounded-card border border-line bg-surface p-2 shadow-e1">{links()}</div>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="pt-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
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
