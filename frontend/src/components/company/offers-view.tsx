"use client";

import { OffersManager } from "@/components/company/offers-manager";
import { StaffGate } from "@/components/company/staff-gate";
import { messages } from "@/messages";

const text = messages.company.offers;

/** The company offers page. The company comes from the person's own memberships, never the address alone. */
export function CompanyOffersView() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <StaffGate basePath="/company/offers">
        {(company) => (
          <>
            <p className="text-sm text-muted-foreground" data-company-name>
              {company.company_name}
            </p>
            <OffersManager companyId={company.company_id} />
          </>
        )}
      </StaffGate>
    </div>
  );
}
