"use client";

import { useState } from "react";

import { MAX_COMPARE } from "@/lib/comparison/selection";
import { useComparison } from "@/lib/comparison/store";
import type { CatalogueKind } from "@/lib/catalogue/params";
import { format, messages } from "@/messages";

const text = messages.toggle;

/**
 * "Compare" checkbox for a product. `name` is used only for the accessible label and the spoken
 * confirmation; it is not stored. When the comparison already has three products, the box for any
 * other product stays visible but refuses to tick, and says why, so keyboard and screen-reader
 * users are not left guessing.
 */
export function ComparisonToggle({
  kind,
  id,
  name,
}: {
  kind: CatalogueKind;
  id: string;
  name: string;
}) {
  const ready = useComparison((state) => state.hydrated);
  const selected = useComparison((state) => state.selection[kind].includes(id));
  const full = useComparison((state) => state.selection[kind].length >= MAX_COMPARE);
  const [announcement, setAnnouncement] = useState("");
  const blocked = ready && full && !selected;

  const change = () => {
    const outcome = useComparison.getState().toggle(kind, id);
    const count = useComparison.getState().selection[kind].length;
    setAnnouncement(
      outcome === "full"
        ? format(text.full, { max: MAX_COMPARE })
        : outcome === "added"
          ? format(text.added, { name, count, max: MAX_COMPARE })
          : format(text.removed, { name }),
    );
  };

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={ready && selected}
          onChange={change}
          aria-disabled={blocked}
          aria-label={format(text.labelFor, { name })}
          className="size-4 rounded border-input accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span aria-hidden="true">{text.label}</span>
      </label>
      {blocked ? <span className="text-xs text-muted-foreground">{text.fullHint}</span> : null}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
