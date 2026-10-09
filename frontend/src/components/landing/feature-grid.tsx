"use client";

import { ArrowRight, BookOpen, Building2, Calculator, Route, Scale, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import type { PhotoKey } from "@/lib/photos/photos";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.landing.story.features;

type Feature = { id: "estimate" | "compare" | "track" | "learn" | "companies" | "safety"; icon: LucideIcon; photo: PhotoKey; href: string };

const FEATURES: readonly Feature[] = [
  { id: "estimate", icon: Calculator, photo: "aerial", href: "/estimator" },
  { id: "compare", icon: Scale, photo: "panelMacro", href: "#compare" },
  { id: "track", icon: Route, photo: "installers", href: "/sign-up" },
  { id: "learn", icon: BookOpen, photo: "consultation", href: "/learn" },
  { id: "companies", icon: Building2, photo: "team", href: "/companies" },
  { id: "safety", icon: ShieldAlert, photo: "safetyVisit", href: "/support" },
];

/** Where each feature sits on the orbit (percent of the map) and the spoke to it, worked out once from six even angles. */
const RADIUS = 38;
const SPOTS = FEATURES.map((_, index) => {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  return { x: +(50 + RADIUS * Math.cos(angle)).toFixed(2), y: +(50 + RADIUS * Math.sin(angle)).toFixed(2) };
});

const DOTS = [
  { x: 12, y: 24 },
  { x: 88, y: 18 },
  { x: 94, y: 62 },
  { x: 8, y: 70 },
  { x: 70, y: 94 },
  { x: 30, y: 6 },
] as const;

/** The six things the site does as an orbit map: the brand at the centre, one photo node per feature around it, slowly turning. Hovering, focusing or pressing a node opens its words and link under the map, and the nodes also take turns by themselves until the pointer or keyboard is on the map. */
export function FeatureGrid() {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % FEATURES.length), 4800);
    return () => window.clearInterval(timer);
  }, [held]);

  const feature = FEATURES[active] ?? FEATURES[0]!;
  const copy = text[feature.id];
  const Icon = feature.icon;

  return (
    <section aria-labelledby="features-title" className="bg-paper py-section-m flex min-h-svh items-center" data-feature-grid>
      <Container size="landing" className="space-y-12 lg:space-y-16">
        <div className="mx-auto space-y-4 text-center">
          <h2 id="features-title" className="type-display-m text-ink">{text.title}</h2>
          <p className="type-body text-ink-2">{text.caption}</p>
        </div>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div
            className="orbit-map relative mx-auto aspect-square w-[min(100%,36rem,64svh)] lg:justify-self-center"
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
          >
            <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full text-line">
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="0.35" />
              <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="0.8 1.6" />
              <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.2" opacity="0.6" />
              {DOTS.map((dot) => (
                <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="0.7" fill="currentColor" />
              ))}
            </svg>
            <div className="orbit absolute inset-0">
              <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
                {SPOTS.map((spot, index) => (
                  <line key={FEATURES[index]!.id} x1="50" y1="50" x2={spot.x} y2={spot.y} stroke={index === active ? "var(--ds-orange)" : "var(--ds-line)"} strokeWidth={index === active ? 0.5 : 0.3} strokeLinecap="round" className="transition-all duration-500 motion-reduce:transition-none" />
                ))}
              </svg>
              {FEATURES.map((item, index) => {
                const spot = SPOTS[index]!;
                const NodeIcon = item.icon;
                const on = index === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    aria-controls="feature-detail"
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onClick={() => setActive(index)}
                    data-feature={item.id}
                    className="group/node absolute -translate-x-1/2 -translate-y-1/2 outline-none"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  >
                    <span className="orbit-node flex flex-col items-center gap-2">
                      <span
                        className={cn(
                          "relative block size-[4.5rem] overflow-hidden rounded-full ring-2 transition-all duration-500 group-focus-visible/node:ring-4 group-focus-visible/node:ring-focus motion-reduce:transition-none sm:size-24",
                          on ? "scale-110 shadow-e3 ring-4 ring-orange" : "ring-line group-hover/node:ring-ink-3",
                        )}
                      >
                        <Photo name={item.photo} sizes="96px" className="size-full object-cover" />
                        <span aria-hidden className={cn("absolute right-1 bottom-1 grid size-7 place-items-center rounded-full shadow-e1 transition-colors duration-500 motion-reduce:transition-none", on ? "bg-orange text-on-orange" : "bg-surface text-ink-2")}>
                          <NodeIcon className="size-3.5" />
                        </span>
                      </span>
                      <span className={cn("type-caption rounded-full px-2.5 py-0.5 font-semibold transition-colors duration-500 motion-reduce:transition-none", on ? "bg-orange text-on-orange" : "bg-surface/80 text-ink-2")}>{text[item.id].title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div aria-hidden className="absolute top-1/2 left-1/2 grid size-[27%] -translate-x-1/2 -translate-y-1/2 place-items-center">
              <span className="hub-glow absolute inset-0 rounded-[2rem] bg-orange/30 blur-2xl" />
              <span className="relative grid size-full place-items-center rounded-[2rem] border border-line bg-surface shadow-e3">
                <LogoMark size={64} />
              </span>
            </div>
          </div>
          <div id="feature-detail" className="mx-auto w-full max-w-lg text-center lg:mx-0 lg:text-left" data-feature-detail={feature.id}>
            <div key={feature.id} className="step-open space-y-6">
              <div className="flex items-center justify-center gap-4 lg:justify-start">
                <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-orange text-on-orange shadow-e2">
                  <Icon className="size-7" />
                </span>
                <span className="type-figure type-caption font-semibold tracking-widest text-ink-3 uppercase">
                  {format(text.counter, { number: String(active + 1).padStart(2, "0"), total: String(FEATURES.length).padStart(2, "0") })}
                </span>
              </div>
              <h3 className="type-display-m text-ink">{copy.title}</h3>
              <p className="type-body mx-auto max-w-md text-ink-2 lg:mx-0">{copy.body}</p>
              <Button asChild size="lg">
                <Link href={feature.href}>
                  {copy.link}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <div aria-hidden className="mt-8 flex items-center justify-center gap-2 lg:justify-start">
              {FEATURES.map((item, index) => (
                <span key={item.id} className={cn("h-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none", index === active ? "w-10 bg-orange" : "w-4 bg-line")} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
