"use client";

import { useEffect, useRef, useState } from "react";

import { countAt, formatNumber } from "@/lib/format/count-up";

/** A figure that counts up from zero the first time it scrolls into view; with reduced motion, or without scripts, it simply shows its value. */
export function CountUp({ value, decimals = 0, duration = 1200, className }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const final = formatNumber(value, decimals);
  const [shown, setShown] = useState(final);
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !element.current) return;
    let frame = 0;
    setShown(formatNumber(0, decimals));
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = (now - start) / duration;
          setShown(formatNumber(countAt(value, progress), decimals));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, decimals, duration]);

  return (
    <>
      <span ref={element} aria-hidden data-count-up={final} className={className}>
        {shown}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
