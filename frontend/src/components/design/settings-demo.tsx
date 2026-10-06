"use client";

import { useState } from "react";

import { SettingRow, SettingsStatus } from "@/components/notifications/notification-settings";
import { messages } from "@/messages";

const text = messages.notifications.settings;

/** The two notification switches with their saved status, for the design page; "saving" only changes the sample. */
export function SettingsDemo() {
  const [reminders, setReminders] = useState(true);
  const [email, setEmail] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="max-w-2xl space-y-3" data-settings-sample>
      <SettingRow name="reminders" label={text.reminders} help={text.remindersHelp} checked={reminders} disabled={false} onChange={(value) => { setReminders(value); setSaved(text.saved); }} />
      <SettingRow name="email" label={text.email} help={text.emailHelp} checked={email} disabled={false} onChange={(value) => { setEmail(value); setSaved(text.saved); }} />
      <SettingsStatus working={false} saved={saved} />
    </div>
  );
}
