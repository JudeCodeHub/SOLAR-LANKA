/** The company directory keeps its state in the address, like the catalogue lists. */
import { messages } from "../../messages/index.ts";
import { PAGE_SIZE, parsePageParam } from "../catalogue/params.ts";
import { DISTRICTS, SERVICES } from "./options.ts";

export { PAGE_SIZE };

const KEYS = ["district", "service"] as const;
type Key = (typeof KEYS)[number];

const ALLOWED: Record<Key, readonly string[]> = { district: DISTRICTS, service: SERVICES };

export type RawParams = Record<string, string | string[] | undefined>;

export interface DirectoryState {
  /** What to show back in the form: the trimmed text the visitor gave, valid or not. */
  values: Partial<Record<Key, string>>;
  /** Only the valid filters. The backend uses the same names. */
  apiQuery: Partial<Record<Key, string>>;
  errors: Partial<Record<Key, string>>;
  page: number;
}

function first(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return (single ?? "").trim();
}

export function parseDirectoryParams(raw: RawParams): DirectoryState {
  const values: DirectoryState["values"] = {};
  const apiQuery: DirectoryState["apiQuery"] = {};
  const errors: DirectoryState["errors"] = {};
  for (const key of KEYS) {
    const value = first(raw[key]);
    if (value === "") continue;
    values[key] = value;
    if (ALLOWED[key].includes(value)) apiQuery[key] = value;
    else errors[key] = messages.forms.validation.invalid;
  }
  return { values, apiQuery, errors, page: parsePageParam(raw.page) };
}

/** The canonical address: only meaningful values, page 1 omitted, stable order. */
export function buildDirectoryHref(
  path: string,
  state: { values: DirectoryState["values"]; page: number },
): string {
  const search = new URLSearchParams();
  for (const key of KEYS) {
    const value = state.values[key];
    if (value) search.set(key, value);
  }
  if (state.page > 1) search.set("page", String(state.page));
  const query = search.toString();
  return query === "" ? path : `${path}?${query}`;
}

/** True when the address carries parameters that do not change the view (blank form fields). */
export function needsCanonicalRedirect(
  raw: RawParams,
  state: { values: DirectoryState["values"]; page: number },
): boolean {
  const given = new URLSearchParams();
  for (const key of [...KEYS, "page"]) {
    const value = raw[key];
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length > 1) return true;
    given.set(key, first(value));
  }
  const [, canonical = ""] = buildDirectoryHref("", state).split("?");
  return given.toString() !== canonical;
}
