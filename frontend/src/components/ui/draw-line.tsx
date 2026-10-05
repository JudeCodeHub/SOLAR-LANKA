"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/** A line that draws itself, left to right or top to bottom, the first time it scrolls into view; under reduced motion it is simply drawn. */
export function DrawLine({ direction = "x", delay = 0, className }: { direction?: "x" | "y"; /** Milliseconds to wait before drawing, so segments can follow one another. */ delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      element.dataset.inView = "true";
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.dataset.inView = "true";
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      data-draw-line={direction}
      style={{ "--draw-from": direction === "x" ? "scaleX(0)" : "scaleY(0)", transitionDelay: `${delay}ms` } as React.CSSProperties}
      className={cn("draw-line block", direction === "x" ? "origin-left" : "origin-top", className)}
    />
  );
}
