import { ArrowUpRight, Building2 } from "lucide-react";
import Link from "next/link";

import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { IconCircle } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { Section as PageSection } from "@/components/ui/section";
import { DIRECTORY_PATH, profileHref } from "@/lib/directory/links";
import type { PublicCompany } from "@/lib/directory/load";
import { formatList, serviceLabel } from "@/lib/landing/format";
import type { Section } from "@/lib/landing/load";
import { messages } from "@/messages";

const text = messages.landing.story.companies;

/** The directory in miniature: a few listings as rows under a cover photo, with fictional companies clearly labelled and a link to all of them. */
export function CompaniesShowcase({ section }: { section: Section<PublicCompany> }) {
  return (
    <PageSection space="l" labelledBy="companies-title">
      <Container size="content" className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16" data-companies-showcase>
        <div className="space-y-5 lg:sticky lg:top-28">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
          <h2 id="companies-title" className="type-display-m text-ink">{text.title}</h2>
          <p className="type-body max-w-md text-ink-2">{text.body}</p>
          <SampleBadge>{text.sampleLabel}</SampleBadge>
          <div>
            <Button asChild size="lg">
              <Link href={DIRECTORY_PATH}>{text.action}</Link>
            </Button>
          </div>
        </div>
        <Card className="gap-0 overflow-hidden p-0">
          <Photo name="companyCover" sizes="(min-width: 1024px) 55vw, 100vw" className="aspect-[21/9] w-full object-cover" />
          {!section.ok ? (
            <div className="p-5">
              <SectionUnavailable />
            </div>
          ) : section.items.length === 0 ? (
            <div className="p-5">
              <EmptyState title={messages.landing.companies.emptyTitle} description={messages.landing.companies.emptyDescription} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {section.items.map((company) => (
                <li key={company.id} className="group/row relative flex items-start gap-4 p-5 transition-colors hover:bg-paper-2 motion-reduce:transition-none">
                  <IconCircle icon={Building2} tone="neutral" size="md" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="type-subheading text-ink">
                        <Link href={profileHref(company.id, DIRECTORY_PATH)} className="underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                          {company.name}
                        </Link>
                      </h3>
                      <Badge variant="info">{messages.directory.approval.badge}</Badge>
                    </div>
                    <p className="type-small text-ink-2">
                      {company.service_districts.length > 0 ? formatList(company.service_districts) : messages.directory.card.noDistricts}
                    </p>
                    {company.services.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5" aria-label={messages.directory.card.services}>
                        {company.services.map((service) => (
                          <li key={service}>
                            <Badge>{serviceLabel(service)}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <ArrowUpRight aria-hidden className="mt-1 size-5 shrink-0 text-ink-3 transition-transform group-hover/row:translate-x-0.5 group-hover/row:-translate-y-0.5 motion-reduce:transition-none" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Container>
    </PageSection>
  );
}
