"use client";

import { useState } from "react";

import { ConfirmAction } from "@/components/company/confirm-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { messages } from "@/messages";

const text = messages.design.overlays;

/** The three overlay patterns side by side, for the design page. */
export function OverlayDemo() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">{text.openDialog}</Button>
        </DialogTrigger>
        <DialogContent closeLabel={text.close}>
          <DialogHeader>
            <DialogTitle>{text.dialogTitle}</DialogTitle>
            <DialogDescription>{text.dialogBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{text.cancel}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>{text.confirm}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
