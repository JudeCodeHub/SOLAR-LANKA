/** One place that turns every API failure into the same typed error, so queries. */
import { format, messages, plural } from "../../messages/index.ts";
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
      : messages.errors.technical.requestFailed;
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
    message: messages.errors.technical.network,
  });
}

/** Anything thrown that is not already an ApiError (a bug, not an API response). */
export function ensureApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return networkError();
  return new ApiError({ status: 0, code: "unknown", message: messages.errors.technical.unknown });
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

/** The wording every screen uses (see src/messages/en.ts). Titles are short; messages say what to do next. */
export function describeError(error: ApiError): ErrorDescription {
  const kind = errorKind(error);
  const text = messages.errors;
  switch (kind) {
    case "signed-out":
      return { kind, ...text.signedOut, retryable: false };
    case "forbidden":
      return { kind, ...text.forbidden, retryable: false };
    case "not-found":
      return { kind, ...text.notFound, retryable: false };
    case "conflict":
      // Business conflicts carry a safe, specific explanation from the server.
      return { kind, title: text.conflict.title, message: error.message, retryable: false };
    case "invalid-input":
      return {
        kind,
        title: text.invalidInput.title,
        message:
          error.issues.length > 0 ? text.invalidInput.withIssues : text.invalidInput.withoutIssues,
        retryable: false,
      };
    case "rate-limited":
      return {
        kind,
        title: text.rateLimited.title,
        message:
          error.retryAfterSeconds !== null
            ? format(plural(text.rateLimited.waitSeconds, error.retryAfterSeconds), {
                seconds: error.retryAfterSeconds,
              })
            : text.rateLimited.wait,
        retryable: true,
      };
    case "unavailable":
      return { kind, ...text.unavailable, retryable: true };
    default:
      return { kind, ...text.unexpected, retryable: true };
  }
}

const MAX_AUTOMATIC_RETRIES = 2;

/** Automatic retry policy for queries. */
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
