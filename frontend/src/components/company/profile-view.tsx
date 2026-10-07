"use client";

import { CompanyProfileEditor } from "@/components/company/profile-editor";
import { PageHeader } from "@/components/ui/page-header";
import { StaffGate } from "@/components/company/staff-gate";
import { messages } from "@/messages";

const text = messages.company.profile;

/** The company profile page. */
export function CompanyProfileView() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <StaffGate basePath="/company/profile">
        {(company) => <CompanyProfileEditor companyId={company.company_id} companyName={company.company_name} />}
      </StaffGate>
    </div>
  );
}
