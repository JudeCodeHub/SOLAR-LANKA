"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { DialLoader } from "@/components/ui/dial-loader";
import { cn } from "@/lib/utils";

/** The one file control: a labelled, full-height bordered field with a rounded "choose" button, its help under it, a turning dial and the words while a file is uploading, and an error with an icon linked to the field. The chosen file is handed to `onFile` and the field is emptied at once, so the same file can be chosen again. */
export function FileChooser({
  id,
  label,
  help,
  accept = "image/jpeg,image/png,image/webp",
  disabled = false,
  busyText,
  error,
  onFile,
  busyMark,
  errorMark,
  children,
  large = false,
}: {
  id: string;
  label: string;
  help?: string;
  accept?: string;
  disabled?: boolean;
  /** Shown with a turning dial while a file is being uploaded. */
  busyText?: string | null;
  error?: string | null;
  onFile: (file: File) => void;
  /** Test marks for the busy line and the error line. */
  busyMark?: string;
  errorMark?: string;
  /** Anything that belongs under the control, such as a note that the file arrived. */
  children?: ReactNode;
  large?: boolean;
}) {
  const marks = (name: string | undefined, key: string) => (name ? { [key]: name } : {});
  return (
    <div className="space-y-2" data-file-chooser>
      <label htmlFor={id} className="block font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={[help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        className={cn("field-control block w-full min-w-0 cursor-pointer p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-paper-2 file:px-4 file:font-medium file:text-ink", large ? "min-h-14 file:min-h-10" : "min-h-12 file:min-h-9")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      {help ? (
        <p id={`${id}-help`} className="type-small text-ink-2">
          {help}
        </p>
      ) : null}
      {busyText ? (
        <p role="status" className="flex items-center gap-2 text-sm text-ink" {...marks(busyMark, "data-uploading")}>
          <DialLoader className="size-5 text-orange-text" />
          {busyText}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger" {...marks(errorMark, "data-error")}>
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
