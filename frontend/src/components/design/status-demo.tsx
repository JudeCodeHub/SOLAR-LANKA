"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import { messages } from "@/messages";

const text = messages.design.navigation.statusDemo;

/** The four tones of the one status style, and a button that adds a note below content that must stay where it is, for the design page. */
export function StatusDemo() {
  const [saved, setSaved] = useState(false);
  return (
    <div className="max-w-xl space-y-3" data-status-sample>
      <StatusNote tone="success">{text.success}</StatusNote>
      <StatusNote tone="info">{text.info}</StatusNote>
      <StatusNote tone="warning">{text.warning}</StatusNote>
      <StatusNote tone="error">{text.error}</StatusNote>
      <Button type="button" onClick={() => setSaved(true)} data-add-note>
        {text.button}
      </Button>
      <div data-live-region role="status" aria-live="polite">
        {saved ? <StatusNote tone="success" data-added>{text.added}</StatusNote> : null}
      </div>
      <p data-below>{text.below}</p>
    </div>
  );
}
