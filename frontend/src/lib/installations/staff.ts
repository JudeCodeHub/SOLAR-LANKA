/** The rules a company applies when moving an installation step, mirroring the backend so errors appear before a request. */
import { format, messages } from "../../messages/index.ts";
import { stepName } from "./progress.ts";

const text = messages.company.installations;

/** The one kind of evidence each step needs before it can be completed. */
export const REQUIRED_EVIDENCE: Record<string, string> = {
  site_survey: "site_survey_record",
  system_design: "approved_system_design",
  permits_and_approvals: "approval_record",
  equipment_delivery: "delivery_record",
  installation_work: "installation_photos",
  inspection_and_testing: "inspection_test_record",
  commissioning: "commissioning_record",
  customer_handover: "handover_acknowledgement",
};

export function evidenceLabel(kind: string): string {
  return text.evidenceKinds[kind] ?? kind;
}

export interface StepRow {
  id: string;
  kind: string;
  position: number;
  status: string;
}

export interface Actions {
  /** A pending step can start only once the step before it is completed. */
  start: "yes" | "no";
  /** The previous step that must be completed first, when starting is not possible. */
  waitingFor: string | null;
  complete: boolean;
  reset: boolean;
  final: boolean;
}

export function stepActions(step: StepRow, steps: readonly StepRow[]): Actions {
  const previous = steps.find((other) => other.position === step.position - 1);
  const ready = step.position === 1 || previous?.status === "completed";
  return {
    start: step.status === "pending" && ready ? "yes" : "no",
    waitingFor: step.status === "pending" && !ready && previous ? stepName(previous.kind) : null,
    complete: step.status === "in_progress",
    reset: step.status === "in_progress",
    final: step.status === "completed",
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The completion form's problems, one message per field; empty when it can be sent. */
export function validateComplete(input: { assetId: string; note: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const id = input.assetId.trim();
  if (id === "") errors.assetId = text.errors.evidenceRequired;
  else if (!UUID.test(id)) errors.assetId = text.errors.evidenceFormat;
  if (input.note.length > 1000) errors.note = text.errors.tooLong;
  return errors;
}

export function validateReset(input: { reason: string }): Record<string, string> {
  const reason = input.reason.trim();
  if (reason === "") return { reason: text.errors.reasonRequired };
  if (reason.length > 1000) return { reason: text.errors.tooLong };
  return {};
}

export type Attempt = "start" | "complete" | "reset";

/** Why a refused move failed, from the step as it stands now, never from the server's wording. */
export function refusalText(attempt: Attempt, fresh: StepRow | undefined, steps: readonly StepRow[]): string {
  if (!fresh) return text.refused.gone;
  const wanted = attempt === "start" ? "pending" : "in_progress";
  if (fresh.status !== wanted) {
    return format(text.refused.moved, { step: stepName(fresh.kind), status: messages.tracking.statuses[fresh.status] ?? fresh.status });
  }
  if (attempt === "start") {
    const waiting = stepActions(fresh, steps).waitingFor;
    return waiting ? format(text.refused.waiting, { previous: waiting }) : text.refused.generic;
  }
  if (attempt === "complete") return format(text.refused.evidence, { kind: evidenceLabel(REQUIRED_EVIDENCE[fresh.kind] ?? "") });
  return text.refused.generic;
}
