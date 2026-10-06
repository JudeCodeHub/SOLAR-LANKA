import Link from "next/link";

import { FeaturedProducts } from "@/components/landing/featured-products";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import type { ProductListItem } from "@/lib/catalogue/load";
import type { Section as LandingSection } from "@/lib/landing/load";
import { messages } from "@/messages";

const text = messages.landing.story.catalogue;

/** The catalogue on the landing page: a headline, a few panels and inverters, and a link to each full list that is always there. */
export function CatalogueShowcase({ panels, inverters }: { panels: LandingSection<ProductListItem>; inverters: LandingSection<ProductListItem> }) {
  return (
    <div className="border-y border-line bg-paper-2" data-catalogue-showcase>
      <Section space="l" labelledBy="catalogue-title">
        <Container size="content" className="space-y-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl space-y-4">
              <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
              <h2 id="catalogue-title" className="type-display-m text-ink">{text.title}</h2>
              <p className="type-body text-ink-2">{text.body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/panels">{text.panels}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/inverters">{text.inverters}</Link>
              </Button>
            </div>
          </div>
          <FeaturedProducts id="panels" title={messages.landing.products.panelsTitle} section={panels} viewAll={{ href: "/panels", noun: messages.catalogue.panels.resultsNoun }} />
          <FeaturedProducts id="inverters" title={messages.landing.products.invertersTitle} section={inverters} viewAll={{ href: "/inverters", noun: messages.catalogue.inverters.resultsNoun }} />
        </Container>
      </Section>
    </div>
  );
}
