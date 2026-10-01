import "server-only";

import { parseApiBaseUrl } from "./proxy.ts";

/** The FastAPI address, from the server-only API_BASE_URL variable. Throws if missing or invalid. */
export function apiBaseUrl(): string {
  return parseApiBaseUrl(process.env.API_BASE_URL);
}
