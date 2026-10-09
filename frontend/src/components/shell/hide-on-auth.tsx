"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The sign-in and sign-up pages stand alone, with no top bar and no footer; this renders its children everywhere else. */
export function HideOnAuthPages({ children }: { children: ReactNode }) {
  return /^\/(sign-in|sign-up)(\/|$)/.test(usePathname()) ? null : children;
}
