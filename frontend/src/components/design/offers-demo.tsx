"use client";

import { OfferForm } from "@/components/company/offer-form";
import { Preview, SpecBlock } from "@/components/company/offers-manager";
import { emptyOfferForm } from "@/lib/offers/offer";
import { messages } from "@/messages";

const text = messages.company.offers;
const product = { kind: "panel" as const, specifications: { wattage_w: "545", efficiency_percent: "21.1", category: null, capacity_kw: null } };

/** A company offer as it reads on the offers page: the product's read-only specifications, the preview of what customers see, and the offer form, for the design page. */
export function OffersDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-offers-form-sample>
      <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1">
        <SpecBlock product={product as never} />
        <Preview offer={{ indicative_price: "95000.00", currency: "LKR", is_demo_price: true, company_claim: "Ten-year product warranty" }} />
        <Preview offer={{ indicative_price: null, currency: "LKR", is_demo_price: false, company_claim: null }} />
      </div>
      <div className="space-y-3 rounded-card border-2 border-orange-text/50 bg-paper p-5">
        <h4 className="font-medium text-ink">{text.offer.editing}</h4>
        <OfferForm initial={emptyOfferForm} submitLabel={text.form.save} onCancel={() => undefined} onSubmit={async () => undefined} />
      </div>
    </div>
  );
}
