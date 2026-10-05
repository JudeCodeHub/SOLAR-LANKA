import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Four icon sizes: 16, 20, 24 and 32 px. */
export const ICON_SIZES = { sm: "size-4", md: "size-5", lg: "size-6", xl: "size-8" } as const;

/** Tones for an icon disc; each pairs an icon colour with its tinted fill. */
export const ICON_TONES = {
  neutral: "bg-paper-2 text-ink-2",
  orange: "bg-orange-tint text-orange-text",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
} as const;

/** A decorative icon at a standard size; pair it with words, since it is hidden from screen readers. */
export function Icon({ icon: Glyph, size = "md", className }: { icon: LucideIcon; size?: keyof typeof ICON_SIZES; className?: string }) {
  return <Glyph aria-hidden className={cn(ICON_SIZES[size], className)} />;
}

const DISC = { sm: "size-8", md: "size-10", lg: "size-14", xl: "size-20" } as const;
const GLYPH = { sm: "size-4", md: "size-5", lg: "size-7", xl: "size-10" } as const;

/** An icon on a tinted disc. */
export function IconCircle({ icon: Glyph, tone = "orange", size = "md", className }: { icon: LucideIcon; tone?: keyof typeof ICON_TONES; size?: keyof typeof DISC; className?: string }) {
  return (
    <span data-slot="icon-circle" className={cn("grid shrink-0 place-items-center rounded-full", DISC[size], ICON_TONES[tone], className)}>
      <Glyph aria-hidden className={GLYPH[size]} />
    </span>
  );
}
