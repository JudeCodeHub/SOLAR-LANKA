import { BadgeCheck, Calculator, Route, Scale } from "lucide-react";

import { DrawLine } from "@/components/ui/draw-line";
import { Container } from "@/components/ui/container";
import { IconCircle } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { format, messages } from "@/messages";

const text = messages.landing.story.how;

const STEPS = [
  { id: "estimate", icon: Calculator },
  { id: "compare", icon: Scale },
  { id: "choose", icon: BadgeCheck },
  { id: "track", icon: Route },
] as const;

/** Four steps joined by a line that draws itself as the strip scrolls into view. */
export function HowItWorks() {
  return (
    <div className="border-y border-line bg-paper-2 lg:flex lg:min-h-svh lg:items-center" data-how-it-works>
      <Section space="l" labelledBy="how-title" className="w-full">
        <Container size="wide" className="space-y-12">
          <div className="max-w-2xl space-y-4">
            <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
            <h2 id="how-title" className="type-display-m text-ink">{text.title}</h2>
          </div>
          <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
            {STEPS.map((step, index) => (
              <li key={step.id} className="relative flex gap-5 md:flex-col md:gap-4">
                <IconCircle icon={step.icon} size="lg" tone="orange" />
                {index < STEPS.length - 1 ? (
                  <span aria-hidden className="absolute top-[3.75rem] -bottom-[2.25rem] left-[1.625rem] w-0.5 bg-line md:top-[1.625rem] md:right-[-1.25rem] md:bottom-auto md:left-[3.75rem] md:h-0.5 md:w-auto">
                    <DrawLine direction="y" delay={index * 500} className="size-full bg-orange md:hidden" />
                    <DrawLine direction="x" delay={index * 500} className="hidden size-full bg-orange md:block" />
                  </span>
                ) : null}
                <div className="space-y-1.5">
                  <p className="type-caption font-semibold tracking-widest text-ink-3 uppercase">{format(text.stepLabel, { number: index + 1 })}</p>
                  <h3 className="type-subheading text-ink">{text.steps[step.id].title}</h3>
                  <p className="type-small max-w-[16rem] text-ink-2">{text.steps[step.id].body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
    </div>
  );
}
