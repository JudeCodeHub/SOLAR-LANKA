import { auth } from "@clerk/nextjs/server";

import { apiBaseUrl } from "@/lib/api/config";
import {
  buildUpstreamHeaders,
  buildUpstreamUrl,
  filterResponseHeaders,
  isCrossSiteWrite,
  MAX_BODY_BYTES,
  proxyError,
  UPSTREAM_TIMEOUT_MS,
} from "@/lib/api/proxy";

/** Same-origin gateway to the FastAPI backend: /api/<path> is forwarded to <API_BASE_URL>/<path>. */
async function forward(request: Request, context: RouteContext<"/api/[...path]">) {
  let base: string;
  try {
    base = apiBaseUrl();
  } catch {
    return proxyError(503, "service_unavailable", "The API is not configured.");
  }

  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = buildUpstreamUrl(base, path, incoming.search);
  if (target === null) {
    return proxyError(400, "bad_request", "The request path is not valid.");
  }
  if (isCrossSiteWrite(request.method, request.headers, incoming.origin)) {
    return proxyError(403, "forbidden", "Cross-site requests are not allowed.");
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return proxyError(413, "bad_request", "The request body is too large.");
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return proxyError(413, "bad_request", "The request body is too large.");
    }
  }

  // If Clerk cannot supply a token (session just ended, Clerk unreachable) forward without one.
  let token: string | null = null;
  try {
    const { getToken } = await auth();
    token = await getToken();
  } catch {
    console.error("API gateway: could not obtain a session token");
  }
  const headers = buildUpstreamHeaders(request.headers, token);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    // Report the failure class only: never log URLs, headers or tokens.
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error(timedOut ? "API proxy: upstream timed out" : "API proxy: upstream unreachable");
    return proxyError(
      timedOut ? 504 : 503,
      "service_unavailable",
      "The service is temporarily unavailable.",
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: filterResponseHeaders(upstream.headers),
  });
}

export {
  forward as DELETE,
  forward as GET,
  forward as HEAD,
  forward as PATCH,
  forward as POST,
  forward as PUT,
};
