/** Checks an evidence file in the browser before it is sent; the backend checks again and has the final word. */
import { format, messages } from "../../messages/index.ts";

const text = messages.company.installations.upload;

export const EVIDENCE_MAX_BYTES = 8 * 1_048_576;
export const EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** The reason a file cannot be used as evidence, or null when it can be sent. */
export function evidenceProblem(file: { name: string; type: string; size: number }): string | null {
  if (!(EVIDENCE_TYPES as readonly string[]).includes(file.type)) return format(text.wrongType, { name: file.name });
  if (file.size === 0) return format(text.empty, { name: file.name });
  if (file.size > EVIDENCE_MAX_BYTES) return format(text.tooBig, { name: file.name, max: EVIDENCE_MAX_BYTES / 1_048_576 });
  return null;
}
