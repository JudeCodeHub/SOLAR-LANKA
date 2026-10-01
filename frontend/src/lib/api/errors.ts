/**
 * One place that turns every API failure into the same typed error, so queries, mutations and
 * the UI all describe problems the same way. Pure functions with no React imports.
 *
 * The backend's error contract (docs in app/api/schemas/errors.py) guarantees stable `code`
 * values and messages that are safe to show, so business conflicts can display the server's
 * own wording. The gateway produces errors in the same shape when the backend is unreachable.
 */
import type { components } from "./schema";

export type ErrorCode = components["schemas"]["ErrorCode"];
export type ValidationIssue = components["schemas"]["ValidationIssue"];

/** Codes the browser can produce without a backend response. */
export type ClientErrorCode = "network" | "unknown";

/** How the UI groups failures, independent of the HTTP details. */
export type ErrorKind =
  | "signed-out"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "rate-limited"
  | "unavailable"
  | "unexpected";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | ClientErrorCode;
  readonly issues: readonly ValidationIssue[];
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    status: number;
    code: ErrorCode | ClientErrorCode;
    message: string;
    issues?: readonly ValidationIssue[];
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.issues = init.issues ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  "bad_request",
  "unauthenticated",
  "forbidden",
  "not_found",
  "method_not_allowed",
  "conflict",
  "validation_error",
  "rate_limited",
  "internal_error",
  "service_unavailable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRetryAfter(response: Response | undefined): number | null {
  const raw = response?.headers.get("retry-after");
  const seconds = raw === null || raw === undefined ? NaN : Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

function fallbackCode(status: number): ErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  return status >= 500 ? "internal_error" : "bad_request";
}

/** Normalise a failed response. `body` is the already-parsed JSON body, if there was one. */
export function toApiError(response: Response | undefined, body: unknown): ApiError {
  const status = response?.status ?? 0;
  const retryAfterSeconds = parseRetryAfter(response);
  const payload = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code =
    payload && typeof payload.code === "string" && ERROR_CODES.has(payload.code)
      ? (payload.code as ErrorCode)
      : fallbackCode(status);
  const message =
    payload && typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : "The request could not be completed.";
  const issues =
    payload && Array.isArray(payload.issues)
      ? payload.issues.filter(
          (issue): issue is ValidationIssue =>
            isRecord(issue) && typeof issue.code === "string" && typeof issue.message === "string",
        )
      : [];
  return new ApiError({ status, code, message, issues, retryAfterSeconds });
}

/** The request never produced a response: offline, DNS, connection reset, aborted. */
export function networkError(): ApiError {
  return new ApiError({
    status: 0,
    code: "network",
    message: "The server could not be reached.",
  });
}

/** Anything thrown that is not already an ApiError (a bug, not an API response). */
export function ensureApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return networkError();
  return new ApiError({ status: 0, code: "unknown", message: "Something went wrong." });
}

export function errorKind(error: ApiError): ErrorKind {
  switch (error.code) {
    case "unauthenticated":
      return "signed-out";
    case "forbidden":
      return "forbidden";
    case "not_found":
      return "not-found";
    case "conflict":
      return "conflict";
    case "validation_error":
    case "bad_request":
      return "invalid-input";
    case "rate_limited":
      return "rate-limited";
    case "service_unavailable":
    case "network":
      return "unavailable";
    default:
      return "unexpected";
  }
}

export interface ErrorDescription {
  kind: ErrorKind;
  title: string;
  message: string;
  /** Whether trying the same request again could succeed without the user changing anything. */
  retryable: boolean;
}

/** The wording every screen uses. Titles are short; messages say what to do next. */
export function describeError(error: ApiError): ErrorDescription {
  const kind = errorKind(error);
  switch (kind) {
    case "signed-out":
      return {
        kind,
        title: "Sign in required",
        message: "Your session has ended or you are not signed in. Sign in and try again.",
        retryable: false,
      };
    case "forbidden":
      return {
        kind,
        title: "Not allowed",
        message: "You do not have permission to do this.",
        retryable: false,
      };
    case "not-found":
      return {
        kind,
        title: "Not found",
        message: "This item does not exist or is not available to you.",
        retryable: false,
      };
    case "conflict":
      // Business conflicts carry a safe, specific explanation from the server.
      return { kind, title: "Cannot be done now", message: error.message, retryable: false };
    case "invalid-input":
      return {
        kind,
        title: "Check your input",
        message:
          error.issues.length > 0
            ? "Some details need attention:"
            : "The request was not accepted. Check what you entered and try again.",
        retryable: false,
      };
    case "rate-limited":
      return {
        kind,
        title: "Too many requests",
        message:
          error.retryAfterSeconds !== null
            ? `Please wait ${error.retryAfterSeconds} seconds and try again.`
            : "Please wait a moment and try again.",
        retryable: true,
      };
    case "unavailable":
      return {
        kind,
        title: "Service unavailable",
        message: "The service is temporarily unavailable. Try again in a moment.",
        retryable: true,
      };
    default:
      return {
        kind,
        title: "Something went wrong",
        message: "An unexpected error occurred. Try again, and contact support if it continues.",
        retryable: true,
      };
  }
}

const MAX_AUTOMATIC_RETRIES = 2;

/**
 * Automatic retry policy for queries. Only transient failures are retried: no response at all,
 * or the gateway/service reporting it is unavailable. Client mistakes, permission problems and
 * business conflicts never are, and neither are plain 500s, which would just repeat a bug.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_AUTOMATIC_RETRIES) return false;
  const apiError = ensureApiError(error);
  return apiError.code === "network" || [502, 503, 504].includes(apiError.status);
}

interface FetchResult<T> {
  data?: T | undefined;
  error?: unknown;
  response: Response;
}

/**
 * Run an openapi-fetch call and return its data, or throw an ApiError. Use inside query and
 * mutation functions so TanStack Query always receives the same error type:
 *
 *   queryFn: () => unwrap(() => api.GET("/users/me"))
 */
export async function unwrap<T>(run: () => Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await run();
  } catch (error) {
    throw ensureApiError(error);
  }
  if (result.response.ok) {
    // 204 and other empty successes have no data; callers expecting none type it as void.
    return result.data as T;
  }
  throw toApiError(result.response, result.error);
}
