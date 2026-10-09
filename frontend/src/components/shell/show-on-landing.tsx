"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The marketing top bar and footer belong to the landing page only: signed-in pages have the app shell, and the sign-in and sign-up pages stand alone. */
export function ShowOnLanding({ children }: { children: ReactNode }) {
  return usePathname() === "/" ? children : null;
}
