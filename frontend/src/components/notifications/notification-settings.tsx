"use client";

import { CircleCheck } from "lucide-react";
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
    <section aria-labelledby="settings-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-settings>
      <h2 id="settings-title" className="type-heading text-ink">
        {text.title}
      </h2>
      <p className="type-body text-ink-2">{text.intro}</p>
      <QueryState query={query}>
        {(current) => (
          <div className="space-y-3">
            {(
              [
                ["reminders_enabled", text.reminders, text.remindersHelp, "reminders"],
                ["email_enabled", text.email, text.emailHelp, "email"],
              ] as const
            ).map(([key, label, help, name]) => (
              <SettingRow key={key} name={name} label={label} help={help} checked={(shown ?? current)[key]} disabled={save.isPending} onChange={(value) => change(current, key, value)} />
            ))}
            <SettingsStatus working={save.isPending} saved={status} />
            {save.error ? <ApiErrorMessage error={save.error} /> : null}
          </div>
        )}
      </QueryState>
    </section>
  );
}

/** One switch with its label and help, the whole row pressable; the switch is a native checkbox shown as a switch, so it works from the keyboard and is announced as one. */
export function SettingRow({ name, label, help, checked, disabled, onChange }: { name: string; label: string; help: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="rounded-card border border-line bg-paper p-4 has-[:checked]:border-orange-text/40 has-[:checked]:bg-orange-tint" data-setting-row={name}>
      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 text-base font-medium text-ink">
        <span>{label}</span>
        <input type="checkbox" role="switch" className="field-switch mr-1 origin-right scale-125" checked={checked} aria-disabled={disabled} aria-describedby={`setting-${name}-help`} data-setting={name} onChange={(event) => onChange(event.target.checked)} />
      </label>
      <p id={`setting-${name}-help`} className="type-small max-w-reading text-ink-2">
        {help}
      </p>
    </div>
  );
}

/** The saved status: always present so a screen reader hears it, and shown with a tick once the change is saved. */
export function SettingsStatus({ working, saved }: { working: boolean; saved: string | null }) {
  const message = working ? text.working : saved;
  return (
    <p role="status" className="flex min-h-6 items-center gap-2 text-sm font-medium text-ink" data-settings-status>
      {message && !working ? <CircleCheck aria-hidden className="size-4 text-success" /> : null}
      {message}
    </p>
  );
}
