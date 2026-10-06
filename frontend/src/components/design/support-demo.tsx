"use client";

import { useState } from "react";

import { CaseCard, SafetyBox, UnsafeField } from "@/components/support/customer-support";

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
      <div className="max-w-xl space-y-3" data-unsafe-sample>
        <UnsafeField checked={unsafe} onChange={setUnsafe} />
      </div>
    </div>
  );
}
