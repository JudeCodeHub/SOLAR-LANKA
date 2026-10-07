"use client";

import { useState } from "react";

import { CaseCard, SafetyBox, UnsafeField } from "@/components/support/customer-support";
import { PhotoList } from "@/components/support/photo-list";
import { UpdatesList } from "@/components/support/updates-list";
import { dangerFirst } from "@/lib/support/support";
import { messages } from "@/messages";

const update = (id: string, kind: "message" | "status" | "assigned", extra: Record<string, unknown>) => ({ id, kind, actor_id: null, actor_role: "staff" as const, body: null, created_at: "2026-10-02T04:30:00Z", from_status: null, to_status: null, shared: true, subject_id: null, ...extra });
const UPDATES = [
  update("u1", "status", { from_status: "open", to_status: "in_progress" }),
  update("u2", "message", { body: "We will visit on Thursday to check the inverter.", actor_role: "staff" }),
  update("u3", "assigned", { shared: false, actor_role: "staff" }),
  update("u4", "message", { body: "Thank you. The display is lit again this morning.", actor_role: "customer", created_at: "2026-10-03T03:00:00Z" }),
] as never;
const CASES = [
  { id: "s1", status: "open", symptom: "The display shows a fault and the inverter is silent", unsafe_now: false },
  { id: "s2", status: "in_progress", symptom: "A burning smell near the inverter", unsafe_now: true },
  { id: "s3", status: "resolved", symptom: "Output looked low on cloudy days", unsafe_now: false },
  { id: "s4", status: "closed", symptom: "App showed the wrong time", unsafe_now: false },
];

/** The support screens' safety card, one case in each status, and the unsafe box with its warning, for the design page. */
export function SupportDemo() {
  const [unsafe, setUnsafe] = useState(false);
  return (
    <div className="space-y-4" data-support-sample>
      <SafetyBox />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-cases>
        {CASES.map((item) => (
          <li key={item.id}>
            <CaseCard item={item} />
          </li>
        ))}
      </ul>
      <ul className="grid gap-4 sm:grid-cols-2" data-company-cases>
        {[...CASES.filter((item) => item.unsafe_now), ...CASES.filter((item) => !item.unsafe_now).slice(0, 1)].map((item) => (
          <li key={item.id}>
            <CaseCard item={item} href={`/company/support/${item.id}?company=c1`} unsafeLabel={messages.support.company.unsafeFirst} />
          </li>
        ))}
      </ul>
      <ul className="grid gap-4 sm:grid-cols-2" data-technician-cases>
        {dangerFirst([CASES[0], CASES[2], CASES[1]].filter((item): item is (typeof CASES)[number] => item !== undefined)).map((item) => (
          <li key={item.id}>
            <CaseCard item={item} href={`/technician/support/${item.id}`} unsafeLabel={messages.support.company.unsafeFirst} />
          </li>
        ))}
      </ul>
      <div className="grid gap-6 lg:grid-cols-2" data-updates-sample>
        <div className="space-y-3">
          <h3 className="type-subheading text-ink">{messages.support.customer.updatesTitle}</h3>
          <UpdatesList updates={UPDATES} companySide={false} />
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading text-ink">{messages.support.customer.photosTitle}</h3>
          <PhotoList photos={[{ asset_id: "a1" }, { asset_id: "a2" }]} fetchPhoto={() => Promise.resolve(new Blob())} label={messages.support.customer.photoDownload} none={messages.support.customer.noPhotos} />
          <PhotoList photos={[]} fetchPhoto={() => Promise.resolve(new Blob())} label={messages.support.customer.photoDownload} none={messages.support.customer.noPhotos} />
          <h3 className="type-subheading text-ink">{messages.support.company.sharedTag}</h3>
          <UpdatesList updates={UPDATES} companySide />
        </div>
      </div>
      <div className="max-w-xl space-y-3" data-unsafe-sample>
        <UnsafeField checked={unsafe} onChange={setUnsafe} />
      </div>
    </div>
  );
}
