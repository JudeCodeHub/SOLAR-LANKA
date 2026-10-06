import { Circle, CircleCheck, Clock, type LucideIcon } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SampleBadge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/photo";
import { Section } from "@/components/ui/section";
import type { PhotoKey } from "@/lib/photos/photos";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.landing.story.tracking;
const kinds = messages.tracking.kinds;
const statuses = messages.tracking.statuses;

type State = "completed" | "in_progress" | "pending";

/** The eight installation steps, in the order the app tracks them, with an example of where an installation might stand. */
const STEPS: { kind: string; state: State }[] = [
  { kind: "site_survey", state: "completed" },
  { kind: "system_design", state: "completed" },
  { kind: "permits_and_approvals", state: "completed" },
  { kind: "equipment_delivery", state: "in_progress" },
  { kind: "installation_work", state: "pending" },
  { kind: "inspection_and_testing", state: "pending" },
  { kind: "commissioning", state: "pending" },
  { kind: "customer_handover", state: "pending" },
];

const ICONS: Record<State, LucideIcon> = { completed: CircleCheck, in_progress: Clock, pending: Circle };
const TONES: Record<State, string> = {
  completed: "text-success",
  in_progress: "text-orange-text",
  pending: "text-ink-3",
};

/** Photos for four of the steps, shown beside the timeline. */
const PHOTOS: { photo: PhotoKey; kind: string; shape: string }[] = [
  { photo: "siteSurvey", kind: "site_survey", shape: "row-span-2" },
  { photo: "delivery", kind: "equipment_delivery", shape: "aspect-[4/3]" },
  { photo: "installation", kind: "installation_work", shape: "aspect-[4/3]" },
  { photo: "handover", kind: "customer_handover", shape: "col-span-2 aspect-[16/9]" },
];

/** Transparency: the real eight steps as a timeline with a sample status for each (icon and words, never colour alone), beside photos of four of them. */
export function TrackingSection() {
  const completed = STEPS.filter((step) => step.state === "completed").length;
  return (
    <div id="tracking" className="scroll-mt-20 border-y border-line bg-paper-2" data-tracking-section>
      <Section space="l" labelledBy="tracking-title">
        <Container size="content" className="space-y-12">
          <div className="max-w-2xl space-y-4">
            <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
            <h2 id="tracking-title" className="type-display-m text-ink">{text.title}</h2>
            <p className="type-body text-ink-2">{text.body}</p>
          </div>
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
            <div className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-e1 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
                <p className="type-small font-medium text-ink-2">{format(messages.tracking.progress, { completed, total: STEPS.length })}</p>
                <SampleBadge>{text.sampleLabel}</SampleBadge>
              </div>
              <ol className="space-y-1" aria-label={messages.tracking.steps}>
                {STEPS.map((step, index) => {
                  const Icon = ICONS[step.state];
                  return (
                    <li key={step.kind} className={cn("flex min-h-12 items-center gap-3 sm:gap-4 rounded-field px-3 py-2", step.state === "in_progress" && "bg-orange-tint")} data-step={step.kind} data-state={step.state}>
                      <Icon aria-hidden className={cn("size-5 shrink-0", TONES[step.state])} />
                      <span className="type-figure w-5 text-sm text-ink-3">{index + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <span className="type-body font-medium text-ink">{kinds[step.kind]}</span>
                        <span className={cn("type-small font-medium", step.state === "pending" ? "text-ink-3" : step.state === "in_progress" ? "text-orange-text" : "text-success")}>{statuses[step.state]}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <ul className="grid grid-cols-2 gap-4">
              {PHOTOS.map((item) => (
                <li key={item.photo} className={cn("relative min-h-0 overflow-hidden rounded-card border border-line shadow-e1", item.shape)}>
                  <Photo name={item.photo} sizes="(min-width: 1024px) 24vw, 45vw" className="absolute inset-0 size-full object-cover" />
                  <span className="type-caption absolute bottom-3 left-3 rounded-full bg-surface/90 px-3 py-1 font-semibold text-ink backdrop-blur-sm">{kinds[item.kind]}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>
    </div>
  );
}
