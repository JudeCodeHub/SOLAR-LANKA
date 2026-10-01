import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildUpstreamHeaders,
  buildUpstreamUrl,
  EVIDENCE_BODY_BYTES,
  filterResponseHeaders,
  isCrossSiteWrite,
  MAX_BODY_BYTES,
  maxBodyBytes,
  parseApiBaseUrl,
  proxyError,
} from "./proxy.ts";

const BASE = "http://127.0.0.1:8000";

test("parseApiBaseUrl normalises valid addresses and rejects unsafe ones", () => {
  assert.equal(parseApiBaseUrl("http://127.0.0.1:8000/"), BASE);
  assert.equal(parseApiBaseUrl(" https://api.example.test/v1// "), "https://api.example.test/v1");
  for (const bad of [undefined, "", "  ", "not a url", "ftp://x.test", "http://u:p@x.test"]) {
    assert.throws(() => parseApiBaseUrl(bad));
  }
  assert.throws(() => parseApiBaseUrl("http://x.test/?a=1"));
  assert.throws(() => parseApiBaseUrl("http://x.test/#frag"));
});

test("buildUpstreamUrl maps /api paths and keeps the query string", () => {
  assert.equal(buildUpstreamUrl(BASE, ["users", "me"], ""), `${BASE}/users/me`);
  assert.equal(
    buildUpstreamUrl(BASE, ["catalogue", "panels"], "?limit=5&search=a%20b"),
    `${BASE}/catalogue/panels?limit=5&search=a%20b`,
  );
  assert.equal(buildUpstreamUrl(BASE, ["a b", "c"], ""), `${BASE}/a%20b/c`);
});

test("buildUpstreamUrl refuses anything that could escape the path", () => {
  const rejected = [
    [],
    [".."],
    ["users", ".."],
    ["."],
    [""],
    ["a/b"],
    ["a\\b"],
    ["bad\u0000"],
    ["bad\nline"],
  ];
  for (const segments of rejected) {
    assert.equal(buildUpstreamUrl(BASE, segments, ""), null, JSON.stringify(segments));
  }
  assert.equal(buildUpstreamUrl(BASE, ["x"], `?q=${"a".repeat(5000)}`), null);
});

test("request headers are allowlisted and the client cannot supply its own token", () => {
  const incoming = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    "idempotency-key": "k-1",
    "user-agent": "test-agent",
    cookie: "__session=secret-cookie",
    authorization: "Bearer attacker-token",
    host: "evil.test",
    "x-custom": "dropped",
  });
  const signedOut = buildUpstreamHeaders(incoming, null);
  assert.equal(signedOut.get("authorization"), null);
  assert.equal(signedOut.get("cookie"), null);
  assert.equal(signedOut.get("host"), null);
  assert.equal(signedOut.get("x-custom"), null);
  assert.equal(signedOut.get("idempotency-key"), "k-1");
  assert.equal(signedOut.get("user-agent"), "test-agent");

  const signedIn = buildUpstreamHeaders(incoming, "server-issued-token");
  assert.equal(signedIn.get("authorization"), "Bearer server-issued-token");
  assert.equal(signedIn.get("cookie"), null);
});

test("response headers are allowlisted", () => {
  const upstream = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
    "retry-after": "60",
    "set-cookie": "backend=1",
    "content-encoding": "gzip",
    "content-length": "999",
    server: "uvicorn",
  });
  const filtered = filterResponseHeaders(upstream);
  assert.equal(filtered.get("content-type"), "application/json");
  assert.equal(filtered.get("retry-after"), "60");
  for (const dropped of ["set-cookie", "content-encoding", "content-length", "server"]) {
    assert.equal(filtered.get(dropped), null, dropped);
  }
});

test("state-changing requests from another site are refused", () => {
  const own = "http://localhost:3000";
  const make = (headers: Record<string, string>) => new Headers(headers);
  assert.equal(isCrossSiteWrite("POST", make({ origin: "https://evil.test" }), own), true);
  assert.equal(isCrossSiteWrite("DELETE", make({ "sec-fetch-site": "cross-site" }), own), true);
  assert.equal(isCrossSiteWrite("PUT", make({ "sec-fetch-site": "same-site" }), own), true);
  assert.equal(isCrossSiteWrite("POST", make({ origin: own }), own), false);
  assert.equal(isCrossSiteWrite("POST", make({ "sec-fetch-site": "same-origin" }), own), false);
  assert.equal(isCrossSiteWrite("POST", make({}), own), false); // not a browser request
  assert.equal(isCrossSiteWrite("GET", make({ origin: "https://evil.test" }), own), false);
});

test("proxy errors use the backend error contract", async () => {
  const response = proxyError(503, "service_unavailable", "Backend unavailable.");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: { code: "service_unavailable", message: "Backend unavailable.", issues: [] },
  });
});

test("only the evidence upload path may carry more than the default body size", () => {
  const evidence = ["companies", "c1", "installations", "i1", "evidence"];
  assert.equal(maxBodyBytes(evidence), EVIDENCE_BODY_BYTES);
  assert.equal(maxBodyBytes(["companies", "c1", "installations", "i1", "evidence", "a1"]), MAX_BODY_BYTES);
  assert.equal(maxBodyBytes(["users", "me", "requests"]), MAX_BODY_BYTES);
});
