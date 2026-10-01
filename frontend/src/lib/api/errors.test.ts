import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ApiError,
  describeError,
  ensureApiError,
  errorKind,
  networkError,
  shouldRetry,
  toApiError,
  unwrap,
  type ErrorCode,
} from "./errors.ts";

const contract = (code: string, message = "Safe message.", issues: unknown[] = []) => ({
  error: { code, message, issues },
});
const response = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers });

test("toApiError reads the backend error contract", () => {
  const error = toApiError(
    response(422),
    contract("validation_error", "Request validation failed.", [
      { location: ["body", "district"], code: "missing", message: "This field is required." },
      { nonsense: true },
    ]),
  );
  assert.equal(error.status, 422);
  assert.equal(error.code, "validation_error");
  assert.equal(error.message, "Request validation failed.");
  assert.deepEqual(
    error.issues.map((issue) => issue.code),
    ["missing"],
  ); // malformed issues are dropped, valid ones kept
});

test("toApiError falls back to the status when the body is not the contract", () => {
  assert.equal(toApiError(response(401), "<html>").code, "unauthenticated");
  assert.equal(toApiError(response(403), null).code, "forbidden");
  assert.equal(toApiError(response(404), {}).code, "not_found");
  assert.equal(toApiError(response(409), undefined).code, "conflict");
  assert.equal(toApiError(response(429), {}).code, "rate_limited");
  assert.equal(toApiError(response(500), {}).code, "internal_error");
  assert.equal(toApiError(response(418), {}).code, "bad_request");
  // An unknown code from a future backend is not trusted; the status decides.
  assert.equal(toApiError(response(503), contract("brand_new_code")).code, "service_unavailable");
  assert.equal(toApiError(response(500), {}).message, "The request could not be completed.");
});

test("toApiError captures Retry-After seconds", () => {
  assert.equal(toApiError(response(429, { "retry-after": "60" }), {}).retryAfterSeconds, 60);
  assert.equal(toApiError(response(429, { "retry-after": "1.2" }), {}).retryAfterSeconds, 2);
  assert.equal(toApiError(response(429, { "retry-after": "soon" }), {}).retryAfterSeconds, null);
  assert.equal(toApiError(response(429), {}).retryAfterSeconds, null);
});

test("failures without a response become network or unknown errors", () => {
  assert.equal(networkError().code, "network");
  assert.equal(ensureApiError(new TypeError("fetch failed")).code, "network");
  assert.equal(ensureApiError(new Error("bug")).code, "unknown");
  const existing = networkError();
  assert.equal(ensureApiError(existing), existing);
});

test("every error code maps to a display kind and wording", () => {
  const codes: ErrorCode[] = [
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
  ];
  for (const code of codes) {
    const error = new ApiError({ status: 400, code, message: "m" });
    const description = describeError(error);
    assert.equal(description.kind, errorKind(error));
    assert.ok(description.title.length > 0 && description.message.length > 0, code);
  }
  assert.equal(errorKind(networkError()), "unavailable");
  assert.equal(errorKind(ensureApiError(new Error("x"))), "unexpected");
});

test("describeError wording follows the error type", () => {
  const conflict = new ApiError({
    status: 409,
    code: "conflict",
    message: "This quotation has expired. Request a revised offer.",
  });
  assert.equal(describeError(conflict).message, conflict.message);
  assert.equal(describeError(conflict).retryable, false);

  const limited = new ApiError({
    status: 429,
    code: "rate_limited",
    message: "m",
    retryAfterSeconds: 60,
  });
  assert.match(describeError(limited).message, /60 seconds/);
  assert.equal(describeError(limited).retryable, true);

  const invalid = new ApiError({
    status: 422,
    code: "validation_error",
    message: "m",
    issues: [{ code: "missing", message: "Required." }],
  });
  assert.equal(describeError(invalid).title, "Check your input");
  assert.equal(describeError(invalid).retryable, false);

  // Server wording is never shown for errors where it could be internal detail.
  const internal = new ApiError({ status: 500, code: "internal_error", message: "raw detail" });
  assert.doesNotMatch(describeError(internal).message, /raw detail/);
});

test("only transient failures are retried, at most twice", () => {
  const make = (status: number, code: ErrorCode) => new ApiError({ status, code, message: "m" });
  assert.equal(shouldRetry(0, networkError()), true);
  assert.equal(shouldRetry(0, make(503, "service_unavailable")), true);
  assert.equal(shouldRetry(1, make(502, "internal_error")), true);
  assert.equal(shouldRetry(1, make(504, "service_unavailable")), true);
  assert.equal(shouldRetry(2, networkError()), false); // retry cap
  for (const [status, code] of [
    [400, "bad_request"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation_error"],
    [429, "rate_limited"],
    [500, "internal_error"],
  ] as const) {
    assert.equal(shouldRetry(0, make(status, code)), false, String(status));
  }
});

test("unwrap returns data and throws ApiError for every failure", async () => {
  assert.deepEqual(await unwrap(async () => ({ data: { id: 1 }, response: response(200) })), {
    id: 1,
  });
  assert.equal(await unwrap(async () => ({ response: response(204) })), undefined);

  await assert.rejects(
    unwrap(async () => ({
      error: contract("conflict", "Already accepted."),
      response: response(409),
    })),
    (error: unknown) =>
      error instanceof ApiError && error.code === "conflict" && error.message === "Already accepted.",
  );
  await assert.rejects(
    unwrap(async () => {
      throw new TypeError("fetch failed");
    }),
    (error: unknown) => error instanceof ApiError && error.code === "network",
  );
  await assert.rejects(
    unwrap(async () => ({ error: "<html>", response: response(502) })),
    (error: unknown) => error instanceof ApiError && error.status === 502,
  );
});
