"use client";

import { Building2 } from "lucide-react";

import { OffersManager } from "@/components/company/offers-manager";
import { StaffGate } from "@/components/company/staff-gate";
import { PageHeader } from "@/components/ui/page-header";
import { messages } from "@/messages";

const text = messages.company.offers;

/** The company offers page. The company comes from the person's own memberships, never the address alone. */
export function CompanyOffersView() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <StaffGate basePath="/company/offers">
        {(company) => (
          <>
            <p className="inline-flex min-h-8 w-fit items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink" data-company-name>
              <Building2 aria-hidden className="size-4 text-orange-text" />
              {company.company_name}
            </p>
            <OffersManager companyId={company.company_id} />
          </>
        )}
      </StaffGate>
    </div>
  );
}
