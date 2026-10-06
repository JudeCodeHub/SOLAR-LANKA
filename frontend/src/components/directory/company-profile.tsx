import Image from "next/image";
import Link from "next/link";

import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";

import { CredentialList } from "@/components/directory/credential-list";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import type { PublicCompany } from "@/lib/directory/load";
import { serviceLabel } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.directory;

/** A company's public profile: who it is and what the platform has and has not checked, what it does and where, its declared credentials, and a way to start a quotation request. */
export function CompanyProfile({ company, backHref }: { company: PublicCompany; backHref: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-12 px-4 py-10 sm:px-6" data-company-profile={company.id}>
      <header className="relative isolate overflow-hidden rounded-panel border border-line bg-paper-2">
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-2/5 md:block">
          <Photo name="companyCover" sizes="40vw" priority className="size-full object-cover dark:brightness-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-paper-2 via-paper-2/30 to-transparent" />
        </div>
        <div className="max-w-2xl space-y-5 p-6 sm:p-10">
          <BackLink href={backHref}>{text.profile.back}</BackLink>
          <div className="flex flex-wrap items-center gap-4">
            {company.logo ? (
              <div className="relative size-20 shrink-0 overflow-hidden rounded-card border border-line bg-surface">
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
            <h1 className="type-display-m text-ink">{company.name}</h1>
          </div>
          <Badge variant="info">{text.approval.badge}</Badge>
          <div className="space-y-2 pt-1">
            <Button asChild size="lg">
              <Link href="/my/requests/new">{text.profile.requestAction}</Link>
            </Button>
            <p className="type-small max-w-md text-ink-2">{text.profile.requestHelp}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="services-title" className="space-y-3">
          <h2 id="services-title" className="type-heading text-ink">
            {text.profile.services}
          </h2>
          {company.services.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {company.services.map((service) => (
                <li key={service}>
                  <Badge>{serviceLabel(service)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-small text-ink-2">{text.profile.servicesNone}</p>
          )}
        </section>

        <section aria-labelledby="districts-title" className="space-y-3">
          <h2 id="districts-title" className="type-heading text-ink">
            {text.profile.districts}
          </h2>
          {company.service_districts.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {company.service_districts.map((district) => (
                <li key={district}>
                  <Badge>{district}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-small text-ink-2">{text.profile.districtsNone}</p>
          )}
        </section>
      </div>

      <section aria-labelledby="approval-title" className="space-y-3 rounded-card border border-line bg-surface p-6 shadow-e1">
        <h2 id="approval-title" className="type-heading text-ink">
          {text.approval.title}
        </h2>
        <p className="type-small max-w-3xl text-ink-2">{text.approval.body}</p>
      </section>

      <section aria-labelledby="credentials-title" className="space-y-3">
        <h2 id="credentials-title" className="type-heading text-ink">
          {text.credentials.title}
        </h2>
        <p className="type-small max-w-3xl text-ink-2">{text.credentials.intro}</p>
        <CredentialList credentials={company.declared_credentials} />
      </section>
    </div>
  );
}

/** Shown when the profile cannot be loaded because the backend is unavailable. */
export function CompanyProfileUnavailable({ backHref }: { backHref: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <BackLink href={backHref}>{text.profile.back}</BackLink>
      <SectionUnavailable />
    </div>
  );
}
