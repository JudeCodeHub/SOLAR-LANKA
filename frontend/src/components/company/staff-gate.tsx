"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { QueryState } from "@/components/query-state";
import { AccessNotice } from "@/components/states/access-notice";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/api/hooks";
import { type MembershipLike, resolveCompany } from "@/lib/company/profile";
import { format, messages } from "@/messages";

const text = messages.company.profile;
const roleNames: Record<string, string> = text.choose.roles;

/** Decides which company a staff screen is about. */
export function StaffGate({
  basePath,
  children,
}: {
  /** The page's own path, used for the links that choose a company. */
  basePath: string;
  children: (company: MembershipLike) => ReactNode;
}) {
  const requested = useSearchParams().get("company");
  const me = useCurrentUser();
  return (
    <QueryState query={me}>
      {(profile) => {
        const resolution = resolveCompany(profile.memberships, requested);
        if (resolution.kind === "none") {
          return (
            <AccessNotice
              kind="not-allowed"
              title={text.notStaff.title}
              description={resolution.technicianOnly ? text.notStaff.technician : text.notStaff.message}
            />
          );
        }
        if (resolution.kind === "ok") return <>{children(resolution.company)}</>;
        return (
          <section aria-labelledby="choose-title" className="space-y-3">
            <h2 id="choose-title" className="font-heading text-xl font-semibold tracking-tight">
              {resolution.kind === "not-yours" ? text.notYours.title : text.choose.title}
            </h2>
            <p className="text-sm text-ink-3">
              {resolution.kind === "not-yours" ? text.notYours.message : text.choose.intro}
            </p>
            <ul className="space-y-2">
              {resolution.companies.map((company) => (
                <li key={company.company_id}>
                  <Button asChild variant="outline">
                    <Link href={`${basePath}?company=${company.company_id}`}>
                      {format(text.choose.manage, { name: company.company_name })}
                      <span className="sr-only">
                        {format(text.choose.asRole, { role: roleNames[company.role] ?? company.role })}
                      </span>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      }}
    </QueryState>
  );
}
