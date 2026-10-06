"use client";

import { useState } from "react";

import { NotificationCard } from "@/components/notifications/notification-card";

const ITEMS = [
  { id: "n1", title: "A company opened your request", body: "Sunbird Solar has opened your quotation request.", created_at: "2026-10-04T08:00:00Z", read_at: null },
  { id: "n2", title: "You have a new offer", body: "Ceylon Roofs sent an offer that is open until 8 October.", created_at: "2026-10-03T08:00:00Z", read_at: null },
  { id: "n3", title: "Your site visit is confirmed", body: "Wednesday 14 October, 10:00 to 12:00.", created_at: "2026-10-01T08:00:00Z", read_at: "2026-10-02T08:00:00Z" },
];

/** Unread and read notifications, with the read and unread button working, for the design page. */
export function NotificationsDemo() {
  const [items, setItems] = useState(ITEMS);
  return (
    <ul className="max-w-2xl space-y-3" data-notifications-sample>
      {items.map((item) => (
        <li key={item.id}>
          <NotificationCard
            item={item}
            destination={{ href: `/my/requests/${item.id}`, label: "Open" }}
            working={false}
            onToggle={(id, read) => setItems((all) => all.map((entry) => (entry.id === id ? { ...entry, read_at: read ? "2026-10-05T08:00:00Z" : null } : entry)))}
          />
        </li>
      ))}
    </ul>
  );
}
