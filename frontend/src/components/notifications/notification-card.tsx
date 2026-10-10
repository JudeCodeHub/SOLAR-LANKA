"use client";

import { Bell, BellRing } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/catalogue/detail";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.notifications;

/** One notification: unread ones carry a bar, a tint and the word "Unread"; read ones are quiet. */
export function NotificationCard({
  item,
  destination,
  working,
  onToggle,
}: {
  item: { id: string; title: string; body: string; created_at: string; read_at: string | null };
  destination: { href: string; label: string } | null;
  working: boolean;
  onToggle: (id: string, read: boolean) => void;
}) {
  const unread = item.read_at === null;
  return (
    <article
      className={cn("space-y-3 rounded-card border p-5 text-sm", unread ? "border-orange-text/40 bg-orange-tint shadow-[inset_4px_0_0_var(--ds-orange-text),var(--ds-shadow-1)]" : "border-line bg-surface shadow-e1")}
      data-notification={unread ? "unread" : "read"}
    >
      <div className="flex flex-wrap items-center gap-3">
        {unread ? <BellRing aria-hidden className="size-5 text-orange-text" /> : <Bell aria-hidden className="size-5 text-ink-3" />}
        <h2 className={cn("type-subheading text-ink", unread ? "font-semibold" : "font-medium")}>{item.title}</h2>
        <Badge variant={unread ? "orange" : "neutral"} data-badge={unread ? "unread" : "read"}>
          {unread ? text.unreadBadge : text.readBadge}
        </Badge>
      </div>
      <p className="type-body text-ink">{item.body}</p>
      <p className="text-ink-2">{format(text.received, { date: formatLongDate(item.created_at) ?? item.created_at })}</p>
      <div className="flex flex-wrap gap-3">
        {destination ? (
          <Button asChild>
            <Link href={destination.href}>{destination.label}</Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" aria-disabled={working} data-action={unread ? "mark-read" : "mark-unread"} onClick={() => onToggle(item.id, unread)}>
          {working ? text.working : unread ? text.markRead : text.markUnread}
        </Button>
      </div>
    </article>
  );
}
