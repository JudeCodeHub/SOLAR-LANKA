import Link from "next/link";

import { CredentialList } from "@/components/directory/credential-list";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { profileHref } from "@/lib/directory/links";
import type { PublicCompany } from "@/lib/directory/load";
import { formatList, serviceLabel } from "@/lib/landing/format";
import { messages } from "@/messages";

const text = messages.directory;

/** A directory entry: the cover photo, the name as one link, the approval label, where it works and what it does, and its declared credentials. */
export function CompanyCard({ company, listHref }: { company: PublicCompany; listHref: string }) {
  return (
    <Card className="group/company relative h-full gap-0 overflow-hidden p-0 transition-shadow hover:shadow-e3 motion-reduce:transition-none" data-company={company.id}>
      <Photo name="companyCover" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="aspect-[16/7] w-full object-cover dark:brightness-90" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <h3 className="type-subheading text-ink">
            <Link
              href={profileHref(company.id, listHref)}
              className="inline-flex min-h-11 items-center underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:underline"
            >
              {company.name}
            </Link>
          </h3>
          <Badge variant="info">{text.approval.badge}</Badge>
        </div>
        <dl className="description-list text-sm">
          <dt>{text.card.districts}</dt>
          <dd>
            {company.service_districts.length > 0 ? (
              formatList(company.service_districts)
            ) : (
              <span className="text-ink-3">{text.card.noDistricts}</span>
            )}
          </dd>
          <dt>{text.card.services}</dt>
          <dd>
            {company.services.length > 0 ? (
              formatList(company.services.map(serviceLabel))
            ) : (
              <span className="text-ink-3">{text.card.noServices}</span>
            )}
          </dd>
        </dl>
        {company.declared_credentials.length > 0 ? (
          <div className="space-y-2">
            <p className="type-small font-semibold text-ink">{messages.directory.credentials.title}</p>
            <CredentialList credentials={company.declared_credentials} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
