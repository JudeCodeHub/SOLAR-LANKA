/** Rules for forwarding browser requests from the Next.js origin to the FastAPI backend. */

/** Request headers that may reach the backend. Everything else, including cookies, is dropped. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "idempotency-key",
  "if-match",
  "if-none-match",
  "user-agent", // Arcjet bot detection reads it.
  "x-forwarded-for", // Client address for per-client rate limits; set by the trusted edge.
  "svix-id", // Clerk webhook signature headers.
  "svix-timestamp",
  "svix-signature",
] as const;

/** Response headers that may reach the browser. */
const FORWARDED_RESPONSE_HEADERS = [
  "allow",
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
  "retry-after",
  "vary",
  "www-authenticate",
] as const;

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Same limit as the backend's webhook body cap; the API only exchanges small JSON documents. */
export const MAX_BODY_BYTES = 1_048_576;
export const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_QUERY_LENGTH = 4_096;

/** Validate the configured backend address: http(s) origin, optionally with a path prefix. */
export function parseApiBaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) {
    throw new Error("API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env.");
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("API_BASE_URL must be an absolute http(s) URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("API_BASE_URL must be an http(s) URL without credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("API_BASE_URL must not contain a query string or fragment.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Build the backend URL for `/api/<segments>`. */
export function buildUpstreamUrl(
  base: string,
  segments: readonly string[],
  search: string,
): string | null {
  if (segments.length === 0 || search.length > MAX_QUERY_LENGTH) {
    return null;
  }
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      /[/\\\u0000-\u001f\u007f]/.test(segment)
    ) {
      return null;
    }
  }
  const path = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${path}${search}`;
}

/** Allowlisted headers plus the session token, which the caller obtained server-side. */
export function buildUpstreamHeaders(incoming: Headers, token: string | null): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  // A client-supplied Authorization header is never trusted or forwarded.
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return headers;
}

export function filterResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  return headers;
}

/** The proxy authenticates with the browser's session cookie. */
export function isCrossSiteWrite(method: string, headers: Headers, ownOrigin: string): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) {
    return false;
  }
  const origin = headers.get("origin");
  if (origin !== null && origin !== ownOrigin) {
    return true;
  }
  const site = headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

export type ProxyErrorCode = "bad_request" | "forbidden" | "service_unavailable";

/** Errors the proxy itself produces, in the same shape as the backend's error contract. */
export function proxyError(status: number, code: ProxyErrorCode, message: string): Response {
  return Response.json(
    { error: { code, message, issues: [] } },
    { status, headers: { "cache-control": "no-store" } },
  );
}
