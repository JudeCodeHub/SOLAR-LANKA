import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { components } from "@/lib/api/schema";
import { formatList, serviceLabel } from "@/lib/landing/format";
import type { Section } from "@/lib/landing/load";
import { format, messages } from "@/messages";

type Company = components["schemas"]["PublicCompanyResponse"];

/**
 * Directory listings. "Approved" means the platform published the profile; credentials are shown
 * as the company's own claim and are never presented as verified.
 */
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
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{company.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">{text.districts}: </span>
                    {formatList(company.service_districts)}
                  </p>
                  <p>
                    <span className="font-medium">{text.services}: </span>
                    {formatList(company.services.map(serviceLabel))}
                  </p>
                  {company.declared_credentials.length > 0 ? (
                    <div>
                      <p className="font-medium">{text.credentials}</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {company.declared_credentials.map((credential) => (
                          <li key={`${credential.name}-${credential.issuer}`}>
                            {format(text.credentialLine, {
                              name: credential.name,
                              issuer: credential.issuer,
                            })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
