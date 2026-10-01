import Link from "next/link";

import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIRECTORY_PATH, profileHref } from "@/lib/directory/links";
import { formatOfferPrice } from "@/lib/catalogue/detail";
import type { OffersResult } from "@/lib/catalogue/load-detail";
import { messages } from "@/messages";

const text = messages.detail.offers;

/**
 * Sample offers from approved companies. Prices are labelled as demonstration samples and the
 * company's claim as the company's own, unverified statement. No price is not shown as zero.
 */
export function OffersSection({ offers }: { offers: OffersResult }) {
  return (
    <section aria-labelledby="offers-title" className="space-y-3">
      <h2 id="offers-title" className="font-heading text-2xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{text.intro}</p>
      {!offers.ok ? (
        <SectionUnavailable />
      ) : offers.items.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-no-offers>
          {text.none}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          className="underline-offset-2 hover:underline focus-visible:underline"
                        >
                          {offer.company_name}
                        </Link>
                      </h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">{text.price}: </span>
                      {price ?? <span data-no-price>{text.noPrice}</span>}
                      {price && offer.is_demo_price ? (
                        <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {text.sample}
                        </span>
                      ) : null}
                    </p>
                    <p>
                      <span className="font-medium">{text.claim}: </span>
                      {offer.company_claim ?? <span className="text-muted-foreground">{text.noClaim}</span>}
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
