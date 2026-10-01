/** How an installation's steps read to its customer: how far along it is and what is happening now. */
import { format, messages } from "../../messages/index.ts";

const text = messages.tracking;

export interface StepLike {
  kind: string;
  position: number;
  status: string;
}

export function stepName(kind: string): string {
  return text.kinds[kind] ?? kind;
}

/** Completed steps out of all steps, in words. */
export function progressText(completed: number, total: number): string {
  if (total > 0 && completed >= total) return text.allDone;
  return format(text.progress, { completed, total });
}

/** What is happening now: the step in progress, else the next one waiting, else that all work is done. */
export function currentStepText(steps: readonly StepLike[]): string {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const active = ordered.find((step) => step.status === "in_progress") ?? ordered.find((step) => step.status === "pending");
  if (!active) return ordered.length > 0 ? text.allDone : text.noSteps;
  return format(active.status === "in_progress" ? text.now : text.next, { step: stepName(active.kind) });
}
