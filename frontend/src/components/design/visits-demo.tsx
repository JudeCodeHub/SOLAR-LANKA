"use client";

import { useState } from "react";

import { SlotFields } from "@/components/visits/slot-fields";
import { VisitStatusBlock } from "@/components/visits/customer-visits";
import { emptyRow, slotRequest, type SlotRow } from "@/lib/visits/slots";
import { messages } from "@/messages";

const base = { timezone: "Asia/Colombo", confirmed_starts_at: null, confirmed_ends_at: null };
const preferred = [
  { id: "p1", starts_at: "2026-10-14T04:30:00Z", ends_at: "2026-10-14T06:30:00Z" },
  { id: "p2", starts_at: "2026-10-15T08:00:00Z", ends_at: "2026-10-15T10:00:00Z" },
];
const VISITS = [
  { key: "requested", visit: { ...base, status: "requested" as const } },
  { key: "alternatives_offered", visit: { ...base, status: "alternatives_offered" as const } },
  { key: "confirmed", visit: { ...base, status: "confirmed" as const, confirmed_starts_at: "2026-10-14T04:30:00Z", confirmed_ends_at: "2026-10-14T06:30:00Z" } },
  { key: "cancelled", visit: { ...base, status: "cancelled" as const } },
];

/** The visit statuses and the preferred-times fields (with their checks) for the design page. */
export function VisitsDemo() {
  const [rows, setRows] = useState<SlotRow[]>([emptyRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-6 lg:grid-cols-2" data-visits-sample>
      <ul className="space-y-3" data-visit-statuses>
        {VISITS.map(({ key, visit }) => (
          <li key={key} className="space-y-3 rounded-card border border-line bg-paper p-4 text-sm" data-visit={key}>
            <VisitStatusBlock visit={visit} preferred={preferred} />
          </li>
        ))}
      </ul>
      <form
        noValidate
        className="space-y-4 rounded-card border border-line bg-paper p-4 text-sm sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setErrors(slotRequest(rows).errors);
        }}
      >
        <SlotFields id="demo" rows={rows} errors={errors} onChange={setRows} />
        <button type="submit" className="h-11 rounded-full bg-orange px-6 font-medium text-on-orange" data-demo-submit>
          {messages.visits.customer.request}
        </button>
      </form>
    </div>
  );
}
