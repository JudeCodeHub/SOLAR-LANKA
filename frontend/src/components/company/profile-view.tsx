"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CompanyProfileEditor } from "@/components/company/profile-editor";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/api/hooks";
import { resolveCompany } from "@/lib/company/profile";
import { format, messages } from "@/messages";

const text = messages.company.profile;
const roleNames: Record<string, string> = text.choose.roles;

/**
 * The company profile page. Which company it shows comes from the signed-in person's own company
 * memberships (administrator or sales), never from the address alone: a company named in the
 * address that is not theirs is refused here, and the backend refuses it too.
 */
export function CompanyProfileView() {
  const requested = useSearchParams().get("company");
  const me = useCurrentUser();
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <QueryState query={me}>
        {(profile) => {
          const resolution = resolveCompany(profile.memberships, requested);
          if (resolution.kind === "none") {
            return (
              <EmptyState
                title={text.notStaff.title}
                description={resolution.technicianOnly ? text.notStaff.technician : text.notStaff.message}
              />
            );
          }
          if (resolution.kind === "ok") {
            return <CompanyProfileEditor companyId={resolution.company.company_id} companyName={resolution.company.company_name} />;
          }
          return (
            <section aria-labelledby="choose-title" className="space-y-3">
              <h2 id="choose-title" className="font-heading text-xl font-semibold tracking-tight">
                {resolution.kind === "not-yours" ? text.notYours.title : text.choose.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {resolution.kind === "not-yours" ? text.notYours.message : text.choose.intro}
              </p>
              <ul className="space-y-2">
                {resolution.companies.map((company) => (
                  <li key={company.company_id}>
                    <Button asChild variant="outline">
                      <Link href={`/company/profile?company=${company.company_id}`}>
                        {format(text.choose.manage, { name: company.company_name })}
                        <span className="sr-only">{format(text.choose.asRole, { role: roleNames[company.role] ?? company.role })}</span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
