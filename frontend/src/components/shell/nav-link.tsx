"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** A navigation link that marks the current page for screen readers and sighted users. */
export function NavLink({
  item,
  onNavigate,
  className,
}: {
  item: NavItem;
  onNavigate?: () => void;
  className?: string;
}) {
  const active = isActive(item.href, usePathname());
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {item.label}
    </Link>
  );
}
