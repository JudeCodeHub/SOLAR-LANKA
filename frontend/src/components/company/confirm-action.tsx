"use client";

import { CircleHelp } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/** A button that asks first: a confirmation that says what will happen, with focus moved to the question. */
export function ConfirmAction({
  id,
  label,
  help,
  title,
  body,
  yes,
  keep,
  onConfirm,
  disabled = false,
  onBeforeOpen,
  variant = "outline",
}: {
  id: string;
  label: string;
  help?: string;
  title: string;
  body: string;
  yes: string;
  keep: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Called before the question opens; returning false keeps it closed, for a form that is not ready. */
  onBeforeOpen?: () => boolean;
  variant?: "outline" | "default";
}) {
  const [confirming, setConfirming] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  if (confirming) {
    return (
      <div role="group" aria-labelledby={`${id}-title`} className="space-y-3 rounded-card border-2 border-orange-text bg-orange-tint p-5 text-ink shadow-e2" data-confirm={id}>
        <h3 id={`${id}-title`} ref={heading} tabIndex={-1} className="type-subheading flex items-start gap-2 text-ink outline-none">
          <CircleHelp aria-hidden className="mt-0.5 size-5 shrink-0 text-orange-text" />
          {title}
        </h3>
        <p className="type-body text-ink">{body}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              setConfirming(false);
              onConfirm();
            }}
            data-confirm-yes={id}
          >
            {yes}
          </Button>
          <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
            {keep}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        aria-disabled={disabled}
        data-action={id}
        onClick={() => {
          if (disabled) return;
          if (onBeforeOpen && !onBeforeOpen()) return;
          setConfirming(true);
          setTimeout(() => heading.current?.focus(), 0);
        }}
      >
        {label}
      </Button>
      {help ? <p className="type-small max-w-xs text-ink-2">{help}</p> : null}
    </div>
  );
}
