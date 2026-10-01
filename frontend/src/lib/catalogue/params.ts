/** The catalogue list pages keep ALL of their state in the address. */
import { messages } from "../../messages/index.ts";

export type CatalogueKind = "panel" | "inverter";

export const PAGE_SIZE = 12;
/** The backend refuses offsets above 10,000; pages beyond this are treated as page 1. */
const MAX_OFFSET = 10_000;
const MAX_PAGE = Math.floor(MAX_OFFSET / PAGE_SIZE) + 1;
const MAX_SEARCH_LENGTH = 100;
const MAX_NUMBER = 1_000_000;
const INVERTER_TYPES = ["on_grid", "off_grid", "hybrid"] as const;

type FieldKind =
  | { type: "text" }
  | { type: "number"; max: number }
  | { type: "choice"; options: readonly string[] };

interface FieldSpec {
  /** Name in the address and in the form. */
  key: string;
  /** Name of the backend query parameter. */
  api: string;
  kind: FieldKind;
}

const FIELDS: Record<CatalogueKind, readonly FieldSpec[]> = {
  panel: [
    { key: "q", api: "search", kind: { type: "text" } },
    { key: "min_w", api: "min_wattage_w", kind: { type: "number", max: MAX_NUMBER } },
    { key: "max_w", api: "max_wattage_w", kind: { type: "number", max: MAX_NUMBER } },
    { key: "min_eff", api: "min_efficiency_percent", kind: { type: "number", max: 100 } },
  ],
  inverter: [
    { key: "q", api: "search", kind: { type: "text" } },
    { key: "type", api: "category", kind: { type: "choice", options: INVERTER_TYPES } },
    { key: "min_kw", api: "min_capacity_kw", kind: { type: "number", max: MAX_NUMBER } },
    { key: "max_kw", api: "max_capacity_kw", kind: { type: "number", max: MAX_NUMBER } },
  ],
};

/** Pairs where the first must not exceed the second. */
const RANGES: Record<CatalogueKind, readonly (readonly [string, string])[]> = {
  panel: [["min_w", "max_w"]],
  inverter: [["min_kw", "max_kw"]],
};

export type RawParams = Record<string, string | string[] | undefined>;

export interface CatalogueState {
  /** What to show back in the form: the trimmed text the visitor gave, valid or not. */
  values: Record<string, string>;
  /** Only the valid filters, using the backend's parameter names. */
  apiQuery: Record<string, string>;
  /** A message per field whose value was not valid. */
  errors: Record<string, string>;
  page: number;
}

function first(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return (single ?? "").trim();
}

function validate(spec: FieldSpec, value: string): string | null {
  const text = messages.forms.validation;
  switch (spec.kind.type) {
    case "text":
      return value.length > MAX_SEARCH_LENGTH ? text.invalid : null;
    case "choice":
      return spec.kind.options.includes(value) ? null : text.invalid;
    case "number": {
      // Plain positive decimals only: no signs, exponents, separators or hex.
      if (!/^\d+(\.\d+)?$/.test(value) || value.length > 12) return text.number;
      const number = Number(value);
      if (!(number > 0)) return text.invalid;
      return number > spec.kind.max ? text.invalid : null;
    }
  }
}

/** A page number from the address: a whole number in range, otherwise page 1. */
export function parsePageParam(raw: string | string[] | undefined): number {
  const text = first(raw);
  const parsed = /^\d{1,5}$/.test(text) ? Number(text) : 1;
  return parsed >= 1 && parsed <= MAX_PAGE ? parsed : 1;
}

export function parseCatalogueParams(kind: CatalogueKind, raw: RawParams): CatalogueState {
  const values: Record<string, string> = {};
  const apiQuery: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const spec of FIELDS[kind]) {
    const value = first(raw[spec.key]);
    if (value === "") continue;
    values[spec.key] = value;
    const problem = validate(spec, value);
    if (problem) errors[spec.key] = problem;
    else apiQuery[spec.api] = value;
  }
  for (const [lowKey, highKey] of RANGES[kind]) {
    const low = values[lowKey];
    const high = values[highKey];
    if (low && high && !errors[lowKey] && !errors[highKey] && Number(low) > Number(high)) {
      errors[highKey] = messages.catalogue.errors.rangeOrder;
      const spec = FIELDS[kind].find((field) => field.key === highKey);
      if (spec) delete apiQuery[spec.api];
    }
  }
  return { values, apiQuery, errors, page: parsePageParam(raw.page) };
}

/** The canonical address for a state: only meaningful values, page 1 omitted, stable order. */
export function buildCatalogueHref(
  path: string,
  kind: CatalogueKind,
  state: { values: Record<string, string>; page: number },
): string {
  const search = new URLSearchParams();
  for (const spec of FIELDS[kind]) {
    const value = state.values[spec.key];
    if (value) search.set(spec.key, value);
  }
  if (state.page > 1) search.set("page", String(state.page));
  const query = search.toString();
  return query === "" ? path : `${path}?${query}`;
}

/** True when the address carries parameters that do not change the view. */
export function needsCanonicalRedirect(
  kind: CatalogueKind,
  raw: RawParams,
  state: { values: Record<string, string>; page: number },
): boolean {
  const given = new URLSearchParams();
  const known = [...FIELDS[kind].map((spec) => spec.key), "page"];
  for (const key of known) {
    const value = raw[key];
    if (value === undefined) continue;
    // A repeated parameter (?q=a&q=b) is not clean, even though only the first value is used.
    if (Array.isArray(value) && value.length > 1) return true;
    given.set(key, first(value));
  }
  const [, canonical = ""] = buildCatalogueHref("", kind, state).split("?");
  return given.toString() !== canonical;
}

export function offsetFor(page: number): number {
  return (page - 1) * PAGE_SIZE;
}

export interface PageInfo {
  page: number;
  pageCount: number;
  /** 1-based position of the first and last item on this page; 0 when there are none. */
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function pageInfo(total: number, page: number): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, current * PAGE_SIZE);
  return {
    page: current,
    pageCount,
    from,
    to,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  };
}

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
export function pageWindow(page: number, pageCount: number, radius = 1): (number | null)[] {
  const wanted = new Set([1, pageCount]);
  for (let n = page - radius; n <= page + radius; n += 1) {
    if (n >= 1 && n <= pageCount) wanted.add(n);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((n, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && n - previous > 1) result.push(null);
    result.push(n);
  });
  return result;
}

/** "415.000" -> "415", "21.40" -> "21.4"; null (unknown) stays null, it is never zero. */
export function formatDecimal(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}
