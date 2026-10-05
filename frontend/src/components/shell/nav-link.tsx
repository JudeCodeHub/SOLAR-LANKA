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
        "inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none",
        active ? "bg-orange-tint text-orange-text" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
        className,
      )}
    >
      {item.label}
    </Link>
  );
}
