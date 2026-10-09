import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CountUp } from "@/components/ui/count-up";
import { photoUrl } from "@/lib/photos/url";
import { messages } from "@/messages";

const text = messages.landing.story.teaser;

/** The photo shown through the moving diamond windows; swap the name to change it. */
const LATTICE_PHOTO = "consultation";

/** The second section: a centred heading and sub-heading on the page background, then, with no box around it, two clean halves: the headline and three sample figures that count up on the left and, on the right, reaching the edge of the page, one photo seen through diamond windows that run along diagonal rows without stopping. */
export function EstimateTeaser() {
  return (
    <section aria-labelledby="teaser-heading" className="bg-paper py-section-m flex min-h-svh items-center" data-estimate-section>
      <div className="w-full space-y-10 lg:space-y-14">
        <Container size="landing">
          <div className="mx-auto space-y-4 text-center">
            <h2 id="teaser-heading" className="type-display-m text-ink">{text.heading}</h2>
            <p className="type-body text-ink-2 lg:whitespace-nowrap">{text.subheading}</p>
          </div>
        </Container>
        <div className="isolate grid lg:grid-cols-2" data-estimate-teaser>
          <div className="flex flex-col justify-center gap-7 px-4 py-6 sm:px-6 lg:justify-self-stretch lg:py-10 lg:pr-12 lg:pl-[max(1.5rem,calc((100vw-var(--container-landing))/2+1.5rem))]">
            <div className="space-y-4">
              <h3 id="teaser-title" className="type-heading text-ink">{text.title}</h3>
              <p className="type-body max-w-md text-ink-2">{text.body}</p>
            </div>
            <p className="type-small text-ink-2">
              {text.inputLabel} <span className="type-figure font-semibold text-ink">{text.inputValue}</span>
            </p>
            <dl className="flex flex-wrap gap-x-10 gap-y-6">
              <div className="flex flex-col-reverse">
                <dt className="type-small mt-2 text-ink-2">{text.size}</dt>
                <dd className="type-figure text-5xl leading-none font-semibold text-ink">
                  <CountUp value={5.4} decimals={1} />
                  <span className="ml-1.5 text-lg font-medium text-ink-2">{text.sizeUnit}</span>
                </dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="type-small mt-2 text-ink-2">{text.output}</dt>
                <dd className="type-figure text-5xl leading-none font-semibold text-ink">
                  <CountUp value={7300} />
                  <span className="ml-1.5 text-lg font-medium text-ink-2">{text.outputUnit}</span>
                </dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="type-small mt-2 text-ink-2">{text.cost}</dt>
                <dd className="type-figure text-5xl leading-none font-semibold text-ink">
                  <CountUp value={1.7} decimals={1} />
                  <span className="ml-1.5 text-lg font-medium whitespace-nowrap text-ink-2">{text.costUnit}</span>
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild size="lg">
                <Link href="/estimator">{text.action}</Link>
              </Button>
              <p className="type-small max-w-[16rem] text-ink-3">{messages.brand.microcopy.indicative}</p>
            </div>
          </div>
          <div aria-hidden className="relative h-[24rem] w-full overflow-hidden lg:h-auto lg:min-h-[40rem]" style={{ "--lattice-photo": `url(${photoUrl(LATTICE_PHOTO, 1440)})` } as React.CSSProperties} data-lattice>
            <div className="lattice">
              <div className="lattice-layer" data-run="rise" />
              <div className="lattice-layer" data-run="sink" />
            </div>
            <div className="absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-paper to-transparent" />
            <div className="absolute inset-y-0 right-0 w-1/12 bg-gradient-to-l from-paper to-transparent" />
            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-paper to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-paper to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
