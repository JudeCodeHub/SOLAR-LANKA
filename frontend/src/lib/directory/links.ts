/** Addresses between the directory list and a company's profile. */
import { isProductId } from "../catalogue/links.ts";

export const DIRECTORY_PATH = "/companies";

/** Company ids are UUIDs; anything else is a missing page, not a backend call. */
export const isCompanyId = isProductId;

export function profileHref(id: string, listHref: string): string {
  const path = `${DIRECTORY_PATH}/${encodeURIComponent(id)}`;
  return listHref === DIRECTORY_PATH ? path : `${path}?from=${encodeURIComponent(listHref)}`;
}

export function backHref(from: string | string[] | undefined): string {
  const value = Array.isArray(from) ? from[0] : from;
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return DIRECTORY_PATH;
  if (value === DIRECTORY_PATH || (value.startsWith(`${DIRECTORY_PATH}?`) && !value.includes("#"))) {
    return value;
  }
  return DIRECTORY_PATH;
}
