import createClient from "openapi-fetch";

import type { paths } from "./schema";

/** Typed API client for browser code. */
export function createBrowserApi() {
  return createClient<paths>({ baseUrl: "/api", credentials: "same-origin" });
}

export type BrowserApi = ReturnType<typeof createBrowserApi>;
