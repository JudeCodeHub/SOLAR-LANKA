"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** A navigation link that marks the current page for screen readers and sighted users. */
export function NavLink({
  item,
  onNavigate,
  className,
  icon,
  pathname,
  exact = false,
}: {
  item: NavItem;
  onNavigate?: () => void;
  className?: string;
  /** A small icon shown before the label. */
  icon?: ReactNode;
  /** Treat this as the current address, for a sample outside the real page. */
  pathname?: string;
  /** Current only on its own address, for a link that is the parent of the others (the area's dashboard). */
  exact?: boolean;
}) {
  const here = usePathname();
  const current = pathname ?? here;
  const active = exact ? current === item.href : isActive(item.href, current);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-10 items-center gap-2.5 rounded-full px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none",
        active ? "bg-orange-tint text-orange-text" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
        className,
      )}
    >
      {icon}
      {item.label}
    </Link>
  );
}
