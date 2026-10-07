import { cn } from "@/lib/utils";

export const EMPTY_ART_KINDS = ["generic", "search", "saved", "inbox", "calendar", "document"] as const;
export type EmptyArtKind = (typeof EMPTY_ART_KINDS)[number];

/** Line art for empty states: one stroke weight, rounded ends, ink for the object and orange for the single accent, like the meter dial. */
export function EmptyArt({ kind = "generic", className }: { kind?: EmptyArtKind; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 96"
      fill="none"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-slot="empty-art"
      data-kind={kind}
      className={cn("size-24 shrink-0 text-ink-2", className)}
    >
      <circle cx="48" cy="48" r="38" stroke="currentColor" strokeDasharray="2 6" opacity="0.5" />
      {kind === "search" ? (
        <>
          <circle cx="42" cy="42" r="15" stroke="currentColor" />
          <path d="M53 53l14 14" className="text-orange-text" stroke="currentColor" />
          <path d="M36 42h12" stroke="currentColor" opacity="0.6" />
        </>
      ) : kind === "saved" ? (
        <>
          <path d="M48 66S28 54 28 40a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 14-20 26-20 26z" stroke="currentColor" />
          <path d="M48 37v10M43 42h10" className="text-orange-text" stroke="currentColor" />
        </>
      ) : kind === "inbox" ? (
        <>
          <path d="M28 52l6-16h28l6 16v12H28z" stroke="currentColor" />
          <path d="M28 52h13l3 5h8l3-5h13" className="text-orange-text" stroke="currentColor" />
        </>
      ) : kind === "calendar" ? (
        <>
          <rect x="27" y="32" width="42" height="36" rx="5" stroke="currentColor" />
          <path d="M27 44h42M38 27v10M58 27v10" stroke="currentColor" />
          <path d="M42 56h12" className="text-orange-text" stroke="currentColor" />
        </>
      ) : kind === "document" ? (
        <>
          <path d="M34 28h20l10 10v30H34z" stroke="currentColor" />
          <path d="M54 28v10h10" stroke="currentColor" />
          <path d="M41 50h16M41 58h10" className="text-orange-text" stroke="currentColor" />
        </>
      ) : (
        <>
          <path d="M30 60a20 20 0 0 1 36 0" stroke="currentColor" />
          <path d="M48 60l9-14" className="text-orange-text" stroke="currentColor" />
          <circle cx="48" cy="60" r="2.5" stroke="currentColor" />
        </>
      )}
    </svg>
  );
}
