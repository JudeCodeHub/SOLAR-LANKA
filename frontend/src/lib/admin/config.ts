/** The estimator configuration editor: turns the administrator's text into the request, and says what is wrong first. */
import { messages } from "../../messages/index.ts";

const text = messages.adminEstimator.errors;

const SOURCES = ["yield", "tariff", "cost"] as const;
const REQUIRED = ["publisher", "title", "url", "unit", "reviewed_on", "limitation"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DraftBody {
  assumptions: Record<string, unknown>;
  source_metadata: Record<string, unknown>;
}

export type ParseResult = { ok: true; body: DraftBody } | { ok: false; errors: Record<"assumptions" | "sources", string> | Partial<Record<"assumptions" | "sources", string>> };

function parseObject(raw: string): { value?: Record<string, unknown>; error?: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: text.notJson };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { error: text.notObject };
  return { value: value as Record<string, unknown> };
}

/** Checks both documents the way the backend will: assumptions an object with content, each source complete. */
export function parseDraft(assumptionsText: string, sourcesText: string): ParseResult {
  const errors: Partial<Record<"assumptions" | "sources", string>> = {};
  const assumptions = parseObject(assumptionsText);
  if (assumptions.error) errors.assumptions = assumptions.error;
  else if (Object.keys(assumptions.value ?? {}).length === 0) errors.assumptions = text.emptyAssumptions;

  const sources = parseObject(sourcesText);
  if (sources.error) errors.sources = sources.error;
  else {
    const value = sources.value ?? {};
    const missing = SOURCES.filter((name) => value[name] === undefined || typeof value[name] !== "object" || value[name] === null);
    if (missing.length > 0) errors.sources = text.missingSource.replace("{names}", missing.join(", "));
    else {
      for (const name of SOURCES) {
        const entry = value[name] as Record<string, unknown>;
        const bad = REQUIRED.find((key) => typeof entry[key] !== "string" || (entry[key] as string).trim() === "");
        if (bad) {
          errors.sources = text.missingField.replace("{source}", name).replace("{field}", bad);
          break;
        }
        if (!/^https?:\/\//i.test(entry.url as string)) {
          errors.sources = text.badUrl.replace("{source}", name);
          break;
        }
        if (!DATE.test(entry.reviewed_on as string) || Number.isNaN(Date.parse(entry.reviewed_on as string))) {
          errors.sources = text.badDate.replace("{source}", name);
          break;
        }
      }
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, body: { assumptions: assumptions.value as Record<string, unknown>, source_metadata: sources.value as Record<string, unknown> } };
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Whether the text differs from the stored content, ignoring formatting. */
export function sameJson(raw: string, stored: unknown): boolean {
  const parsed = parseObject(raw);
  return parsed.value !== undefined && JSON.stringify(sortKeys(parsed.value)) === JSON.stringify(sortKeys(stored));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, sortKeys(v)]));
  return value;
}

export function refusalFor(fresh: { status: string; is_archived: boolean } | undefined, attempt: "save" | "publish" | "archive"): string {
  if (!fresh) return text.refusedGone;
  if (fresh.is_archived) return text.refusedArchived;
  if (attempt === "archive" && fresh.status === "published") return text.refusedNoReplacement;
  if (fresh.status === "published") return text.refusedPublished;
  return text.refusedGeneric;
}
