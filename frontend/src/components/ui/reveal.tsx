"use client";

import { type ReactNode, useEffect, useRef } from "react";

const DELAY = { 0: "", 1: "delay-100", 2: "delay-200", 3: "delay-300", 4: "delay-500" } as const;

/** Fades and lifts its children in the first time they scroll into view. Nothing moves under reduced motion. */
export function Reveal({ delay = 0, className = "", children }: { delay?: keyof typeof DELAY; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
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
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${DELAY[delay]} ${className}`}>
      {children}
    </div>
  );
}
