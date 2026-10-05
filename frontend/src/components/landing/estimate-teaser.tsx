import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { CountUp } from "@/components/ui/count-up";
import { SampleBadge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { messages } from "@/messages";

const text = messages.landing.story.teaser;

/** A small estimator card with example figures, labelled as a sample, leading to the real estimator. */
export function EstimateTeaser() {
  return (
    <Section space="m" labelledBy="teaser-title">
      <Container size="content" className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="space-y-4">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
          <h2 id="teaser-title" className="type-display-m text-ink">{text.title}</h2>
          <p className="type-body max-w-md text-ink-2">{text.body}</p>
          <Button asChild size="lg">
            <Link href="/estimator">{text.action}</Link>
          </Button>
        </div>
        <Card className="gap-5 p-6" data-estimate-teaser>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="type-small font-medium text-ink-2">
              {text.inputLabel} <span className="type-figure font-semibold text-ink">{text.inputValue}</span>
            </p>
            <SampleBadge>{text.sampleLabel}</SampleBadge>
          </div>
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="type-small text-ink-2">{text.size}</dt>
              <dd className="type-figure text-3xl font-semibold text-ink">
                <CountUp value={5.4} decimals={1} />
                <span className="ml-1.5 text-base font-medium text-ink-2">{text.sizeUnit}</span>
              </dd>
            </div>
            <div>
              <dt className="type-small text-ink-2">{text.output}</dt>
              <dd className="type-figure text-3xl font-semibold text-ink">
                <CountUp value={7300} />
                <span className="ml-1.5 text-base font-medium text-ink-2">{text.outputUnit}</span>
              </dd>
            </div>
            <div>
              <dt className="type-small text-ink-2">{text.cost}</dt>
              <dd className="type-figure text-3xl font-semibold text-ink">
                <CountUp value={1.7} decimals={1} />
                <span className="ml-1.5 text-base font-medium text-ink-2">{text.costUnit}</span>
              </dd>
            </div>
          </dl>
          <p className="type-small border-t border-line pt-4 text-ink-3">{messages.brand.microcopy.indicative}</p>
        </Card>
      </Container>
    </Section>
  );
}
