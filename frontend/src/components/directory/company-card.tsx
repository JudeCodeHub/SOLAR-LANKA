import Link from "next/link";

import { CredentialList } from "@/components/directory/credential-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { profileHref } from "@/lib/directory/links";
import type { PublicCompany } from "@/lib/directory/load";
import { formatList, serviceLabel } from "@/lib/landing/format";
import { messages } from "@/messages";

const text = messages.directory;

/**
 * A directory entry. The approved-listing badge (platform review) and the credential list
 * (company's own claims) are separate on purpose, so one is never read as the other.
 */
export function CompanyCard({ company, listHref }: { company: PublicCompany; listHref: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <h3>
            <Link
              href={profileHref(company.id, listHref)}
              className="underline-offset-2 hover:underline focus-visible:underline"
            >
              {company.name}
            </Link>
          </h3>
        </CardTitle>
        <p className="w-fit rounded-full border px-2 py-0.5 text-xs">{text.approval.badge}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">{text.card.districts}: </span>
          {company.service_districts.length > 0 ? (
            formatList(company.service_districts)
          ) : (
            <span className="text-muted-foreground">{text.card.noDistricts}</span>
          )}
        </p>
        <p>
          <span className="font-medium">{text.card.services}: </span>
          {company.services.length > 0 ? (
            formatList(company.services.map(serviceLabel))
          ) : (
            <span className="text-muted-foreground">{text.card.noServices}</span>
          )}
        </p>
        {company.declared_credentials.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium">{messages.directory.credentials.title}</p>
            <CredentialList credentials={company.declared_credentials} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
