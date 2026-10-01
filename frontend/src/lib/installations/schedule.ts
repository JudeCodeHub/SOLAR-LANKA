/** The shared schedule update and internal note forms: what they accept, and the exact requests they make. */
import { messages } from "../../messages/index.ts";

const text = messages.company.installations.share;

export const MAX_TEXT = 1000;
export const MAX_INSTALLATION_NOTE = 2000;

export interface ScheduleInput {
  reason: string;
  nextAction: string;
  /** A calendar date from a date input (yyyy-mm-dd), or empty. */
  delayDate: string;
}

const todayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

/** The problems with a schedule update, one message per field; empty when it can be sent. */
export function validateSchedule(input: ScheduleInput, now: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const reason = input.reason.trim();
  const next = input.nextAction.trim();
  if (reason === "") errors.reason = text.errors.reasonRequired;
  else if (reason.length > MAX_TEXT) errors.reason = text.errors.tooLong;
  if (next.length > MAX_TEXT) errors.nextAction = text.errors.tooLong;
  if (input.delayDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(input.delayDate)) errors.delayDate = text.errors.dateFormat;
  else if (input.delayDate !== "" && input.delayDate <= todayOf(now)) errors.delayDate = text.errors.datePast;
  if (next === "" && input.delayDate === "" && !errors.delayDate) errors.nextAction = text.errors.needOne;
  return errors;
}

/** The request body: a delay is sent as the start of that day in UTC, which is how the customer sees it. */
export function scheduleBody(input: ScheduleInput): { reason: string; next_action?: string; delay_until?: string } {
  const body: { reason: string; next_action?: string; delay_until?: string } = { reason: input.reason.trim() };
  if (input.nextAction.trim() !== "") body.next_action = input.nextAction.trim();
  if (input.delayDate !== "") body.delay_until = `${input.delayDate}T00:00:00Z`;
  return body;
}

export function validateInstallationNote(body: string): string | null {
  const value = body.trim();
  if (value === "") return text.errors.noteRequired;
  if (value.length > MAX_INSTALLATION_NOTE) return text.errors.noteTooLong;
  return null;
}
