import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dial } from "@/components/ui/dial";
import { Photo } from "@/components/ui/photo";
import { messages } from "@/messages";

const text = messages.landing.hero;
const teaser = messages.landing.story.teaser;

/** Place in the entrance order; the stylesheet turns it into a delay. */
const step = (index: number) => ({ "--i": index }) as React.CSSProperties;

/** The landing hero: an oversized serif headline on a blueprint grid, two actions, and the rooftop photo fading in from the right behind a sample dial. */
export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="bg-blueprint relative isolate overflow-hidden lg:flex lg:min-h-svh lg:items-center" data-hero>
      <div className="mx-auto w-full max-w-wide px-4 sm:px-6">
        <div className="relative z-10 space-y-6 pb-section-m pt-28 lg:max-w-[48%] lg:py-28">
          <p style={step(0)} className="hero-in type-caption font-semibold tracking-widest text-orange-text uppercase">{messages.brand.tagline}</p>
          <h1 id="hero-title" style={step(1)} className="hero-in type-display-xl text-ink">{messages.brand.heroLine}</h1>
          <p style={step(2)} className="hero-in type-body max-w-lg text-ink-2">{messages.brand.heroSupport}</p>
          <div style={step(3)} className="hero-in flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/estimator">{messages.brand.primaryAction}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              {signedIn ? <Link href="/account">{text.goToAccount}</Link> : <Link href="/panels">{messages.brand.secondaryAction}</Link>}
            </Button>
          </div>
        </div>
      </div>
      <div className="relative aspect-[16/10] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:z-0 lg:aspect-auto lg:w-[62%]">
        <Photo name="hero" sizes="(min-width: 1024px) 62vw, 100vw" priority className="hero-fade absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-paper via-transparent to-transparent lg:bg-gradient-to-r lg:from-paper lg:via-paper/35 lg:to-transparent" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-t from-paper to-transparent" />
      <div style={step(4)} className="hero-bump group/dial relative z-10 mx-4 -mt-12 mb-8 sm:mx-6 sm:w-[26rem] lg:absolute lg:right-10 lg:bottom-10 lg:mx-0 lg:mt-0 lg:mb-0" data-hero-dial>
        <span aria-hidden className="absolute -inset-5 -z-10 rounded-[2.25rem] bg-orange/30 opacity-70 blur-2xl transition-opacity duration-500 group-hover/dial:opacity-100 motion-reduce:transition-none" />
        <Card variant="glass" className="gap-0 rounded-3xl bg-surface/85 p-5 ring-1 ring-orange/20">
          <div className="flex items-center gap-5">
            <Dial label={text.sampleSize} value={5.4} max={15} unit={text.sampleUnit} size={112} delay={900} />
            <div className="space-y-2.5">
              <p className="type-small text-ink-2">{text.sampleNote}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <dt className="type-caption text-ink-2">{teaser.output}</dt>
              <dd className="type-figure mt-0.5 text-xl font-semibold text-ink">
                {new Intl.NumberFormat("en-GB").format(7300)} <span className="text-sm font-medium text-ink-2">{teaser.outputUnit}</span>
              </dd>
            </div>
            <div>
              <dt className="type-caption text-ink-2">{teaser.cost}</dt>
              <dd className="type-figure mt-0.5 text-xl font-semibold text-ink">
                {(1.7).toFixed(1)} <span className="text-sm font-medium text-ink-2">{teaser.costUnit}</span>
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </section>
  );
}
