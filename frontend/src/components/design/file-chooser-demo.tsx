"use client";

import { useState } from "react";

import { FileChooser } from "@/components/ui/file-chooser";
import { StatusNote } from "@/components/ui/status-note";
import { messages } from "@/messages";

const text = messages.design.navigation.fileDemo;

/** The one file control in its four looks (waiting, uploading, refused, and done), with a working chooser that reports what it was given, for the design page. */
export function FileChooserDemo() {
  const [received, setReceived] = useState<string | null>(null);
  return (
    <div className="grid max-w-3xl gap-4 lg:grid-cols-2" data-file-sample>
      <div data-state="idle" className="rounded-card border border-line bg-surface p-5 shadow-e1">
        <FileChooser id="demo-idle" label={text.label} help={text.help} onFile={(file) => setReceived(file.name)}>
          {received ? <StatusNote tone="success" data-received>{received}</StatusNote> : null}
        </FileChooser>
      </div>
      <div data-state="busy" className="rounded-card border border-line bg-surface p-5 shadow-e1">
        <FileChooser id="demo-busy" label={text.label} help={text.help} disabled busyText={text.busy} busyMark="true" onFile={() => undefined} />
      </div>
      <div data-state="error" className="rounded-card border border-line bg-surface p-5 shadow-e1">
        <FileChooser id="demo-error" label={text.label} help={text.help} error={text.error} errorMark="photo" onFile={() => undefined} />
      </div>
      <div data-state="large" className="rounded-card border border-line bg-surface p-5 shadow-e1">
        <FileChooser id="demo-large" label={text.label} large onFile={() => undefined} />
      </div>
    </div>
  );
}
