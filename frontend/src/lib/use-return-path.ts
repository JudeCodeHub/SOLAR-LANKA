"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** The page the visitor is on, including its search and filters. */
export function useReturnPath(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search === "" ? pathname : `${pathname}?${search}`;
}
