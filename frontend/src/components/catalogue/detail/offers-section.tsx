import Link from "next/link";

import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { SampleBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIRECTORY_PATH, profileHref } from "@/lib/directory/links";
import { formatOfferPrice } from "@/lib/catalogue/detail";
import type { OffersResult } from "@/lib/catalogue/load-detail";
import { messages } from "@/messages";

const text = messages.detail.offers;

/** Sample offers from approved companies. */
export function OffersSection({ offers }: { offers: OffersResult }) {
  return (
    <section aria-labelledby="offers-title" className="space-y-3">
      <h2 id="offers-title" className="type-heading text-ink">
        {text.title}
      </h2>
      <p className="type-small max-w-3xl text-ink-2">{text.intro}</p>
      {!offers.ok ? (
        <SectionUnavailable />
      ) : offers.items.length === 0 ? (
        <p className="type-small text-ink-2" data-no-offers>
          {text.none}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {offers.items.map((offer) => {
            const price = formatOfferPrice(offer);
            return (
              <li key={offer.company_id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>
                      <h3>
                        <Link
                          href={profileHref(offer.company_id, DIRECTORY_PATH)}
                          className="inline-flex min-h-11 items-center underline-offset-2 hover:underline focus-visible:underline"
                        >
                          {offer.company_name}
                        </Link>
                      </h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">{text.price}: </span>
                      {price ? <span className="type-figure font-semibold">{price}</span> : <span data-no-price>{text.noPrice}</span>}
                      {price && offer.is_demo_price ? <SampleBadge className="ml-2">{text.sample}</SampleBadge> : null}
                    </p>
                    <p>
                      <span className="font-medium">{text.claim}: </span>
                      {offer.company_claim ?? <span className="text-ink-3">{text.noClaim}</span>}
                    </p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
