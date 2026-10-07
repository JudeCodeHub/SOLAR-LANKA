"use client";

import { SharedNow, ShareForm } from "@/components/company/installation-share";

const NOW = Date.parse("2026-10-06T00:00:00Z");
const UPDATES = [{ id: "u1", milestone_id: "m1", created_at: "2026-10-01T08:00:00Z", from_status: "pending", to_status: "in_progress", reason: "Panels shipped from the port", next_action: "Confirm a delivery day", delay_until: "2026-10-12T00:00:00Z" }];

/** What the customer currently sees about a step and the form that shares a delay or next action, for the design page; sending needs the API and is not exercised. */
export function ShareDemo() {
  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2" data-share-sample>
      <SharedNow updates={UPDATES} now={NOW} />
      <SharedNow updates={[]} now={NOW} />
      <div className="lg:col-span-2">
        <ShareForm companyId="c1" installationId="i1" milestoneId="m1" now={NOW} />
      </div>
    </div>
  );
}
