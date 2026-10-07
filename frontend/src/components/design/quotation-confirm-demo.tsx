"use client";

import { ConfirmAction } from "@/components/company/confirm-action";
import { format, messages } from "@/messages";

const life = messages.company.quotation.lifecycle;

/** The send, discard and withdraw questions with real wording for a sample quotation, and the send button in its blocked state, for the design page; confirming does nothing. */
export function QuotationConfirmDemo() {
  return (
    <div className="grid gap-6 md:grid-cols-2" data-quotation-confirm-sample>
      <div className="space-y-4" data-ready-to-send>
        <ConfirmAction id="q-send" variant="default" label={life.send.button} title={life.send.confirmTitle} body={format(life.send.confirmBody, { number: 2, total: "LKR 1,600,000.00", days: "14" })} yes={life.send.yes} keep={life.send.keep} onConfirm={() => undefined} />
        <ConfirmAction id="q-discard" label={life.discard.button} help={life.discard.help} title={life.discard.confirmTitle} body={format(life.discard.confirmBodySent, { sent: 1 })} yes={life.discard.yes} keep={life.discard.keep} onConfirm={() => undefined} />
      </div>
      <div className="space-y-4" data-blocked-send>
        <ConfirmAction id="q-send-blocked" variant="default" label={life.send.button} title={life.send.confirmTitle} body="" yes={life.send.yes} keep={life.send.keep} disabled onConfirm={() => undefined} />
        <p className="text-sm font-medium text-warning" data-need-saved>
          {life.send.needSaved}
        </p>
        <ConfirmAction id="q-withdraw" label={life.withdraw.button} help={life.withdraw.help} title={life.withdraw.confirmTitle} body={format(life.withdraw.confirmBody, { number: 2 })} yes={life.withdraw.yes} keep={life.withdraw.keep} onConfirm={() => undefined} />
      </div>
    </div>
  );
}
