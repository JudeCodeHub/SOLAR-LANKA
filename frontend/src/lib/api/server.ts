import "server-only";

import createClient from "openapi-fetch";

import { getBackendToken } from "@/lib/auth/server";

import { apiBaseUrl } from "./config";
import type { paths } from "./schema";

/**
 * Typed API client for server components and server actions. It calls FastAPI directly with
 * a fresh token for the current request. Create one per request; never cache or share it,
 * because it carries that request's identity.
 */
export async function serverApi() {
  const token = await getBackendToken();
  return createClient<paths>({
    baseUrl: apiBaseUrl(),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    fetch: (request) => fetch(request, { cache: "no-store" }),
  });
}
