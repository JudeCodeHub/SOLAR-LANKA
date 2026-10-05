import type { ReactNode } from "react";

const SPACE = { s: "py-section-s", m: "py-section-m", l: "py-section-l", xl: "py-section-xl" } as const;

/** A page section with the standard vertical rhythm; give it a heading id so it is a named region. */
export function Section({ space = "m", labelledBy, className = "", children }: { space?: keyof typeof SPACE; labelledBy?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className={`${SPACE[space]} ${className}`}>
      {children}
    </section>
  );
}
