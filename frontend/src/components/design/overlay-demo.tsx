"use client";

import { useState } from "react";

import { ConfirmAction } from "@/components/company/confirm-action";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { messages } from "@/messages";

const text = messages.design.overlays;

/** The overlay patterns side by side, for the design page. */
export function OverlayDemo() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">{text.openSheet}</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{text.sheetTitle}</SheetTitle>
            <SheetDescription>{text.sheetBody}</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
      <div className="space-y-2">
        <ConfirmAction id="design-confirm" label={text.openConfirm} title={text.confirmTitle} body={text.confirmBody} yes={text.confirm} keep={text.cancel} onConfirm={() => setConfirmed(true)} />
        {confirmed ? <p role="status" className="text-sm text-ink-2">{text.confirmed}</p> : null}
      </div>
    </div>
  );
}
