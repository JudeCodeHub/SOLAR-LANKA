import createClient from "openapi-fetch";

import type { paths } from "./schema";

/**
 * Typed API client for browser code. Calls go to this site's /api gateway, which attaches
 * the session token on the server; no token is handled here. Server components and server
 * actions should use serverApi() instead, because relative URLs do not work on the server.
 */
export function createBrowserApi() {
  return createClient<paths>({ baseUrl: "/api", credentials: "same-origin" });
}

export type BrowserApi = ReturnType<typeof createBrowserApi>;
