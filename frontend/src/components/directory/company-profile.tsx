import Image from "next/image";
import Link from "next/link";

import { CredentialList } from "@/components/directory/credential-list";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import type { PublicCompany } from "@/lib/directory/load";
import { formatList, serviceLabel } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.directory;

/**
 * A company's public profile. Two different kinds of statement are kept in separate, labelled
 * sections: platform approval (the platform reviewed and published the profile) and declared
 * credentials (the company's own claims, never verified by the platform).
 */
export function CompanyProfile({ company, backHref }: { company: PublicCompany; backHref: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
      <Link href={backHref} className="text-sm underline underline-offset-2">
        {text.profile.back}
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        {company.logo ? (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <Image
              src={company.logo.url}
              alt={format(text.profile.logoAlt, { name: company.name })}
              fill
              unoptimized
              sizes="80px"
              className="object-contain"
            />
          </div>
        ) : null}
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{company.name}</h1>
      </header>

      <section aria-labelledby="approval-title" className="space-y-2">
        <h2 id="approval-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.approval.title}
        </h2>
        <p className="w-fit rounded-full border px-2 py-0.5 text-xs">{text.approval.badge}</p>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.approval.body}</p>
      </section>

      <section aria-labelledby="credentials-title" className="space-y-3">
        <h2 id="credentials-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.credentials.title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.credentials.intro}</p>
        <CredentialList credentials={company.declared_credentials} />
      </section>

      <section aria-labelledby="services-title" className="space-y-2">
        <h2 id="services-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.profile.services}
        </h2>
        {company.services.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {company.services.map((service) => (
              <li key={service} className="rounded-full border px-3 py-1 text-sm">
                {serviceLabel(service)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{text.profile.servicesNone}</p>
        )}
      </section>

      <section aria-labelledby="districts-title" className="space-y-2">
        <h2 id="districts-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.profile.districts}
        </h2>
        {company.service_districts.length > 0 ? (
          <p className="text-sm">{formatList(company.service_districts)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{text.profile.districtsNone}</p>
        )}
      </section>
    </div>
  );
}

/** Shown when the profile cannot be loaded because the backend is unavailable. */
export function CompanyProfileUnavailable({ backHref }: { backHref: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <Link href={backHref} className="text-sm underline underline-offset-2">
        {text.profile.back}
      </Link>
      <SectionUnavailable />
    </div>
  );
}
