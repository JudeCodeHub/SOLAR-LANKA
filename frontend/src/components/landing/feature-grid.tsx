import { ArrowRight, BookOpen, Building2, Calculator, Route, Scale, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { IconCircle } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import type { PhotoKey } from "@/lib/photos/photos";
import { cn } from "@/lib/utils";
import { messages } from "@/messages";

const text = messages.landing.story.features;

type Feature = { id: "estimate" | "compare" | "track" | "learn" | "companies" | "safety"; icon: LucideIcon; photo: PhotoKey; href: string; span: string };

/** Six equal cards, three across, so the whole grid fits one screen. */
const FEATURES: Feature[] = [
  { id: "estimate", icon: Calculator, photo: "aerial", href: "/estimator", span: "lg:col-span-4" },
  { id: "compare", icon: Scale, photo: "panelMacro", href: "#compare", span: "lg:col-span-4" },
  { id: "track", icon: Route, photo: "installers", href: "/sign-up", span: "lg:col-span-4" },
  { id: "learn", icon: BookOpen, photo: "consultation", href: "/learn", span: "lg:col-span-4" },
  { id: "companies", icon: Building2, photo: "team", href: "/companies", span: "lg:col-span-4" },
  { id: "safety", icon: ShieldAlert, photo: "safetyVisit", href: "/support", span: "lg:col-span-4" },
];

/** The six things the site does, as an even grid of photo cards, each with an icon, one line and a link. */
export function FeatureGrid() {
  return (
    <Section space="l" labelledBy="features-title" className="lg:flex lg:min-h-svh lg:items-center">
      <Container size="wide" className="space-y-10">
        <div className="max-w-2xl space-y-4">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
          <h2 id="features-title" className="type-display-m text-ink">{text.title}</h2>
        </div>
        <ul className="grid gap-6 lg:grid-cols-12" data-feature-grid>
          {FEATURES.map((feature, index) => (
            <li key={feature.id} className={cn("flex", feature.span)}>
              <Reveal delay={(index % 2) as 0 | 1} className="flex w-full">
                <Card className="group/feature w-full gap-0 overflow-hidden p-0 transition-shadow hover:shadow-e3 motion-reduce:transition-none" data-feature={feature.id}>
                  <div className={cn("relative overflow-hidden", "aspect-[2/1]")}>
                    <Photo name={feature.photo} sizes="(min-width: 1024px) 32vw, 100vw" className="size-full object-cover transition-transform duration-500 group-hover/feature:scale-[1.03] motion-reduce:transition-none" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <IconCircle icon={feature.icon} size="md" tone="orange" />
                    <h3 className="type-subheading text-ink">{text[feature.id].title}</h3>
                    <p className="type-body max-w-md text-ink-2">{text[feature.id].body}</p>
                    <Link href={feature.href} className="group/link mt-auto inline-flex min-h-11 items-center gap-2 pt-2 text-sm font-semibold text-orange-text underline-offset-4 hover:underline">
                      {text[feature.id].link}
                      <ArrowRight aria-hidden className="size-4 transition-transform group-hover/link:translate-x-0.5 motion-reduce:transition-none" />
                    </Link>
                  </div>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
