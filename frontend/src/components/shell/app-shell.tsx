"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, ChevronDown, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { CATEGORY_ICONS, NAV_ICONS } from "@/components/shell/nav-icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type Persona, type SidebarCategory, locate } from "@/lib/navigation";
import { useUnreadCount } from "@/lib/notifications/hooks";
import { saveSidebarState, useSidebarState } from "@/lib/shell-state";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.shell;

/** One category's links, as a list; the current page is marked for sight and for screen readers. */
function Categories({ categories, pathname, collapsed, onNavigate }: { categories: readonly SidebarCategory[]; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const state = useSidebarState();
  const place = locate(pathname, categories);
  return (
    <ul className="flex flex-col gap-1" data-sidebar-categories>
      {categories.map((category) => {
        const CategoryIcon = CATEGORY_ICONS[category.id];
        const here = place?.category.id === category.id;
        const open = state.overrides[category.id] ?? here;
        const first = category.items[0];
        if (collapsed) {
          return (
            <li key={category.id}>
              <Link
                href={first?.href ?? "/dashboard"}
                title={category.label}
                aria-label={category.label}
                aria-current={here ? "true" : undefined}
                onClick={onNavigate}
                className={cn("mx-auto grid size-11 place-items-center rounded-xl transition-colors motion-reduce:transition-none", here ? "bg-orange-tint text-orange-text" : "text-ink-2 hover:bg-paper-2 hover:text-ink")}
              >
                {CategoryIcon ? <CategoryIcon aria-hidden className="size-5" /> : null}
              </Link>
            </li>
          );
        }
        const single = category.items.length === 1 ? first : undefined;
        return (
          <li key={category.id} data-category={category.id}>
            {single ? (
              <Link
                href={single.href}
                aria-current={here ? "page" : undefined}
                onClick={onNavigate}
                className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors motion-reduce:transition-none", here ? "bg-orange-tint text-orange-text shadow-[inset_3px_0_0_var(--ds-orange-text)]" : "text-ink hover:bg-paper-2")}
              >
                {CategoryIcon ? <CategoryIcon aria-hidden className="size-[1.125rem] shrink-0" /> : null}
                <span className="truncate">{category.label}</span>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`category-${category.id}`}
                  aria-label={format(text.toggleCategory, { category: category.label })}
                  onClick={() => saveSidebarState({ ...state, overrides: { ...state.overrides, [category.id]: !open } })}
                  className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors motion-reduce:transition-none", here ? "text-orange-text" : "text-ink hover:bg-paper-2")}
                >
                  {CategoryIcon ? <CategoryIcon aria-hidden className="size-[1.125rem] shrink-0" /> : null}
                  <span className="flex-1 truncate">{category.label}</span>
                  <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none", open ? "rotate-180" : "")} />
                </button>
                {open ? (
                  <ul id={`category-${category.id}`} className="mt-1 mb-2 ml-[1.375rem] flex flex-col gap-0.5 border-l border-line pl-2">
                    {category.items.map((entry) => {
                      const Icon = NAV_ICONS[entry.id];
                      const current = place?.item.id === entry.id;
                      return (
                        <li key={entry.id}>
                          <Link
                            href={entry.href}
                            aria-current={current ? "page" : undefined}
                            onClick={onNavigate}
                            className={cn("flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors motion-reduce:transition-none", current ? "bg-orange-tint text-orange-text shadow-[inset_3px_0_0_var(--ds-orange-text)]" : "text-ink-2 hover:bg-paper-2 hover:text-ink")}
                          >
                            {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
                            <span className="truncate">{entry.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The bell with the unread count, in the top strip. */
function NotificationsLink() {
  const unread = useUnreadCount();
  const count = unread.data ?? 0;
  return (
    <Button asChild variant="ghost" size="icon" className="relative" data-notifications-link>
      <Link href="/notifications" aria-label={count > 0 ? format(text.unread, { count }) : text.notifications}>
        <Bell aria-hidden />
        {count > 0 ? (
          <span aria-hidden className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-orange px-1 text-[0.6875rem] leading-5 font-semibold text-on-orange">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

/**
 * The frame of every signed-in page: a sidebar of categories on the left (icons only when collapsed, a drawer on a phone), and a slim top strip with where you are, the theme switch, notifications and your account.
 * The categories are decided on the server for this person, so the sidebar only ever lists what they may open.
 */
export function AppShell({ categories, persona, children }: { categories: readonly SidebarCategory[]; persona: Persona | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const state = useSidebarState();
  const [drawer, setDrawer] = useState(false);
  const place = locate(pathname, categories);
  const collapsed = state.collapsed;

  return (
    <div className="flex min-h-svh bg-paper" data-app-shell>
      <aside className={cn("sticky top-0 hidden h-svh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 motion-reduce:transition-none lg:flex", collapsed ? "w-[4.75rem]" : "w-72")} data-sidebar>
        <div className={cn("flex h-14 shrink-0 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
          <Link href="/dashboard" aria-label={messages.app.name} className="inline-flex min-h-11 items-center text-ink">
            {collapsed ? <LogoMark size={32} /> : <Logo height={28} />}
          </Link>
        </div>
        <nav aria-label={text.sidebar} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <Categories categories={categories} pathname={pathname} collapsed={collapsed} />
        </nav>
        <div className={cn("flex shrink-0 items-center gap-1 border-t border-line p-3", collapsed ? "flex-col" : "justify-end")}>
          <Button variant="ghost" size="icon" aria-label={collapsed ? text.expand : text.collapse} title={collapsed ? text.expand : text.collapse} onClick={() => saveSidebarState({ ...state, collapsed: !collapsed })}>
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6" data-app-topbar>
          <Sheet open={drawer} onOpenChange={setDrawer}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="border-line lg:hidden" aria-label={text.openMenu}>
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto">
              <SheetHeader>
                <Logo height={28} className="text-ink" />
                <SheetTitle className="sr-only">{text.menuTitle}</SheetTitle>
                <SheetDescription className="sr-only">{text.menuDescription}</SheetDescription>
              </SheetHeader>
              <nav aria-label={text.sidebar} className="px-4 pb-6">
                <Categories categories={categories} pathname={pathname} collapsed={false} onNavigate={() => setDrawer(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          {place ? (
            <nav aria-label={text.breadcrumbs} className="min-w-0 flex-1" data-breadcrumbs>
              <ol className="flex items-center gap-2 text-sm">
                {place.trail.map((name, index) => (
                  <li key={`${name}-${index}`} className="flex min-w-0 items-center gap-2">
                    {index > 0 ? <span aria-hidden className="text-ink-3">/</span> : null}
                    <span className={cn("truncate", index === place.trail.length - 1 ? "font-semibold text-ink" : "text-ink-3")} aria-current={index === place.trail.length - 1 ? "page" : undefined}>
                      {name}
                    </span>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <div className="flex-1" />
          )}
          {persona ? (
            <Badge variant="neutral" className="hidden sm:inline-flex" data-persona={persona}>
              {text.persona[persona]}
            </Badge>
          ) : null}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <NotificationsLink />
          <UserButton />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
