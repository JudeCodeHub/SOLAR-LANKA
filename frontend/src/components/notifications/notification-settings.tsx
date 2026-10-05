"use client";

import { useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
import { useNotificationPreferences, useSavePreferences } from "@/lib/notifications/hooks";
import { messages } from "@/messages";

const text = messages.notifications.settings;

/** The person's own switches for reminders and email, saved as soon as one is changed. */
export function NotificationSettings() {
  const query = useNotificationPreferences();
  const save = useSavePreferences();
  const busy = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  // The choice shows at once and is dropped when the saved values have been read back.
  const [shown, setShown] = useState<{ reminders_enabled: boolean; email_enabled: boolean } | null>(null);

  const change = (current: { reminders_enabled: boolean; email_enabled: boolean }, key: "reminders_enabled" | "email_enabled", value: boolean) => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return;
    busy.current = true;
    setStatus(null);
    setShown({ ...current, [key]: value });
    save.mutate(
      { ...current, [key]: value },
      {
        onSuccess: () => {
          busy.current = false;
          setShown(null);
          setStatus(text.saved);
        },
        onError: () => {
          busy.current = false;
          setShown(null);
        },
      },
    );
  };

  return (
    <section aria-labelledby="settings-title" className="space-y-3 rounded-lg border p-4" data-settings>
      <h2 id="settings-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      <QueryState query={query}>
        {(current) => (
          <div className="space-y-3">
            {(
              [
                ["reminders_enabled", text.reminders, text.remindersHelp, "reminders"],
                ["email_enabled", text.email, text.emailHelp, "email"],
              ] as const
            ).map(([key, label, help, name]) => (
              <div key={key} className="space-y-1">
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                  <input type="checkbox" className="field-check size-6 shrink-0" checked={(shown ?? current)[key]} aria-disabled={save.isPending} aria-describedby={`setting-${name}-help`} data-setting={name} onChange={(event) => change(current, key, event.target.checked)} />
                  <span>{label}</span>
                </label>
                <p id={`setting-${name}-help`} className="pl-9 text-sm text-muted-foreground">
                  {help}
                </p>
              </div>
            ))}
            <p role="status" className="min-h-5 text-sm font-medium" data-settings-status>
              {save.isPending ? text.working : status}
            </p>
            {save.error ? <ApiErrorMessage error={save.error} /> : null}
          </div>
        )}
      </QueryState>
    </section>
  );
}
