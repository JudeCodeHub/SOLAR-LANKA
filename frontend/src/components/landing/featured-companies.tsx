import Link from "next/link";

import { CompanyCard } from "@/components/directory/company-card";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import type { components } from "@/lib/api/schema";
import { DIRECTORY_PATH } from "@/lib/directory/links";
import type { Section } from "@/lib/landing/load";
import { format, messages } from "@/messages";

type Company = components["schemas"]["PublicCompanyResponse"];

/** Directory listings. */
export function FeaturedCompanies({ section }: { section: Section<Company> }) {
  const text = messages.landing.companies;
  return (
    <section aria-labelledby="companies-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="companies-title" className="font-heading text-2xl font-semibold tracking-tight">
          {text.title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.intro}</p>
        {section.ok && section.items.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {format(messages.landing.products.showing, {
              shown: section.items.length,
              total: section.total,
            })}
          </p>
        ) : null}
      </div>
      {!section.ok ? (
        <SectionUnavailable />
      ) : section.items.length === 0 ? (
        <EmptyState title={text.emptyTitle} description={text.emptyDescription} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((company) => (
            <li key={company.id}>
              <CompanyCard company={company} listHref={DIRECTORY_PATH} />
            </li>
          ))}
        </ul>
      )}
      {section.ok && section.items.length > 0 ? (
        <Link href={DIRECTORY_PATH} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2">
          {text.viewAll}
        </Link>
      ) : null}
    </section>
  );
}
