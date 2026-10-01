"use client";

import { CompanyProfileEditor } from "@/components/company/profile-editor";
import { StaffGate } from "@/components/company/staff-gate";
import { messages } from "@/messages";

const text = messages.company.profile;

/**
 * The company profile page. Which company it shows comes from the signed-in person's own company
 * memberships (administrator or sales), never from the address alone: a company named in the
 * address that is not theirs is refused, and the backend refuses it too.
 */
export function CompanyProfileView() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <StaffGate basePath="/company/profile">
        {(company) => <CompanyProfileEditor companyId={company.company_id} companyName={company.company_name} />}
      </StaffGate>
    </div>
  );
}
