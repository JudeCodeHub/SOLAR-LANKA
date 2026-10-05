import { Info } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dial } from "@/components/ui/dial";
import { Photo } from "@/components/ui/photo";
import { SampleBadge } from "@/components/ui/badge";
import { messages } from "@/messages";

const text = messages.landing.hero;

/** The landing hero: an oversized serif headline on a blueprint grid, two actions, and the rooftop photo fading in from the right behind a sample dial. */
export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="bg-blueprint relative isolate overflow-hidden border-b border-line" data-hero>
      <div className="mx-auto w-full max-w-wide px-4 sm:px-6">
        <div className="relative z-10 space-y-6 py-section-m lg:max-w-[48%] lg:py-section-xl">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{messages.brand.tagline}</p>
          <h1 id="hero-title" className="type-display-xl text-ink">{messages.brand.heroLine}</h1>
          <p className="type-body max-w-lg text-ink-2">{messages.brand.heroSupport}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/estimator">{messages.brand.primaryAction}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              {signedIn ? <Link href="/account">{text.goToAccount}</Link> : <Link href="/panels">{messages.brand.secondaryAction}</Link>}
            </Button>
          </div>
          <p className="type-small flex max-w-lg items-start gap-2 text-ink-3">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            {messages.brand.trustLine}
          </p>
        </div>
      </div>
      <div className="relative aspect-[16/10] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:z-0 lg:aspect-auto lg:w-[62%]">
        <Photo name="hero" sizes="(min-width: 1024px) 62vw, 100vw" priority className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent lg:bg-gradient-to-r lg:from-background lg:via-background/35 lg:to-transparent" />
      </div>
      <Card variant="glass" className="relative z-10 mx-4 -mt-12 mb-8 flex-row items-center gap-4 p-3 sm:mx-6 sm:w-80 lg:absolute lg:right-8 lg:bottom-8 lg:mx-0 lg:mt-0 lg:mb-0" data-hero-dial>
        <Dial label={text.sampleSize} value={5.4} max={15} unit={text.sampleUnit} size={104} />
        <div className="space-y-2">
          <SampleBadge>{messages.landing.story.teaser.sampleLabel}</SampleBadge>
          <p className="type-small text-ink-2">{text.sampleNote}</p>
        </div>
      </Card>
    </section>
  );
}
