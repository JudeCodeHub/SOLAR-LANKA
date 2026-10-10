"use client";

import {
  BadgeCheck,
  Calculator,
  Route,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { Container } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import type { PhotoKey } from "@/lib/photos/photos";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.landing.story.how;

type Step = {
  id: keyof typeof text.steps;
  icon: LucideIcon;
  photos: readonly PhotoKey[];
};

/** Each step has its own six pictures, which swap inside the tilted panel when the step is chosen. */
const STEPS: readonly Step[] = [
  {
    id: "estimate",
    icon: Calculator,
    photos: [
      "roofPlan",
      "learnBill",
      "aerial",
      "learnHow",
      "sunrise",
      "consultation",
    ],
  },
  {
    id: "compare",
    icon: Scale,
    photos: [
      "panelMacro",
      "learnPanels",
      "learnDatasheet",
      "team",
      "panelPlaceholder",
      "inverterPlaceholder",
    ],
  },
  {
    id: "choose",
    icon: BadgeCheck,
    photos: [
      "consultation",
      "companyCover",
      "learnGrid",
      "team",
      "signUp",
      "handover",
    ],
  },
  {
    id: "track",
    icon: Route,
    photos: [
      "siteSurvey",
      "delivery",
      "installation",
      "handover",
      "installers",
      "technician",
    ],
  },
];

/** A stepper: the headline and four steps on the left (the chosen one opens), and on the right a tilted panel whose pictures change with the step. */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = STEPS[active] ?? STEPS[0]!;

  const choose = (index: number) => {
    const next = (index + STEPS.length) % STEPS.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      choose(active + 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      choose(active - 1);
    else if (event.key === "Home") choose(0);
    else if (event.key === "End") choose(STEPS.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <section
      aria-labelledby="how-title"
      className="bg-paper py-section-m flex min-h-svh items-center"
      data-how-it-works
    >
      <Container size="landing" className="space-y-12 lg:space-y-16">
        <div className="mx-auto space-y-4 text-center">
          <h2 id="how-title" className="type-display-m text-ink">
            {text.lead} <span className="italic-display">{text.emphasis}</span>
          </h2>
          <p className="type-body text-ink-2">{text.caption}</p>
        </div>
        <div className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
          <div>
            <div
              role="tablist"
              aria-orientation="vertical"
              aria-label={text.tabs}
              className="space-y-1"
            >
              {STEPS.map((item, index) => {
                const open = index === active;
                return (
                  <button
                    key={item.id}
                    ref={(element) => {
                      tabs.current[index] = element;
                    }}
                    type="button"
                    role="tab"
                    id={`how-tab-${item.id}`}
                    aria-selected={open}
                    aria-controls="how-panel"
                    tabIndex={open ? 0 : -1}
                    onClick={() => setActive(index)}
                    onKeyDown={onKey}
                    data-step={item.id}
                    className={cn(
                      "block w-full cursor-pointer border-l-2 py-3 pl-7 text-left transition-colors duration-300 motion-reduce:transition-none",
                      open
                        ? "border-ink"
                        : "border-dashed border-line hover:border-ink-3",
                    )}
                  >
                    <span
                      className={cn(
                        "type-subheading block transition-colors duration-300 motion-reduce:transition-none",
                        open ? "text-ink" : "text-ink-3 hover:text-ink-2",
                      )}
                    >
                      {text.steps[item.id].title}
                    </span>
                    {open ? (
                      <span className="step-open type-body mt-2 block max-w-md text-ink-2">
                        {text.steps[item.id].body}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lg:[perspective:1100px]">
            <div
              role="tabpanel"
              id="how-panel"
              aria-labelledby={`how-tab-${step.id}`}
              aria-label={format(text.panelLabel, {
                step: text.steps[step.id].title,
              })}
              className="mx-auto w-full max-w-[39rem] rounded-[2rem] border border-line bg-surface p-5 shadow-e3 sm:p-8 lg:[transform-style:preserve-3d] lg:[transform:rotateY(-24deg)_rotateX(5deg)_rotateZ(-1deg)]"
              data-how-panel
            >
              <div aria-hidden className="grid grid-cols-3 gap-3 sm:gap-4">
                {step.photos.map((name, index) => (
                  <div
                    key={`${step.id}-${name}`}
                    className="mosaic-tile aspect-[9/7] overflow-hidden rounded-2xl bg-paper-2"
                    style={{ "--i": index } as React.CSSProperties}
                  >
                    <Photo
                      name={name}
                      sizes="(min-width: 1024px) 14vw, 30vw"
                      className="size-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div aria-hidden className="mt-7 flex justify-center gap-3">
                {STEPS.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <span
                      key={item.id}
                      className={cn(
                        "grid size-11 place-items-center rounded-full transition-colors duration-300 motion-reduce:transition-none",
                        index === active
                          ? "bg-orange text-on-orange shadow-e2"
                          : "bg-paper-2 text-ink-3",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
