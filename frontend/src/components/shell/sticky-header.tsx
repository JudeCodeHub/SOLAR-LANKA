"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The header bar: it stays at the top and turns to a quiet frosted strip once the page has scrolled. */
export function StickyHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header
      data-print-hide
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none",
        scrolled ? "border-line bg-paper/80 shadow-e1 backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-paper" : "border-transparent bg-paper",
      )}
    >
      {children}
    </header>
  );
}
