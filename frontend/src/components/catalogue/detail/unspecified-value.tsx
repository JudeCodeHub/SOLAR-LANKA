import { messages } from "@/messages";

/**
 * How an unknown value is shown everywhere: dashed, muted, in words. It must never look like a
 * real value and never read as zero or "no".
 */
export function UnspecifiedValue() {
  return (
    <span
      data-unspecified
      className="inline-block rounded border border-dashed px-1.5 py-0.5 text-muted-foreground italic"
    >
      {messages.catalogue.card.unspecified}
    </span>
  );
}
