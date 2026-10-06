"use client";

import { ConfirmAction } from "@/components/company/confirm-action";
import { format, messages } from "@/messages";

const text = messages.customerOffers.decide;
const vars = { number: 2, name: "Sunbird Solar", total: "LKR 1,600,000.00", date: "8 October 2026" };

/** The accept and decline questions for a sample offer, for the design page; confirming does nothing. */
export function DecisionDemo() {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-4" data-decision-sample>
      <ConfirmAction id="sample-accept" variant="default" label={text.accept} help={text.acceptHelp} title={format(text.acceptTitle, vars)} body={format(text.acceptBody, vars)} yes={text.acceptYes} keep={text.keep} onConfirm={() => undefined} />
      <ConfirmAction id="sample-decline" label={text.decline} help={text.declineHelp} title={format(text.declineTitle, vars)} body={format(text.declineBody, vars)} yes={text.declineYes} keep={text.keep} onConfirm={() => undefined} />
    </div>
  );
}
