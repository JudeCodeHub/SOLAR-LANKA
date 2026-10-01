"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * The page the visitor is on, including its search and filters (/panels?q=trina&page=2), for use
 * as the place to come back to after signing in. Pass the result through signInHref(), which
 * only ever accepts a path on this site.
 */
export function useReturnPath(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search === "" ? pathname : `${pathname}?${search}`;
}
