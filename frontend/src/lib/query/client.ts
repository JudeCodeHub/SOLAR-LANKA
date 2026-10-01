import { isServer, QueryClient } from "@tanstack/react-query";

import { type ApiError, shouldRetry } from "@/lib/api/errors";

// Every query and mutation error is an ApiError (see unwrap in src/lib/api/errors.ts), so
// `error` is typed that way everywhere without per-call generics.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is treated as fresh briefly so navigating between screens does not refetch.
        staleTime: 30_000,
        retry: shouldRetry,
      },
      // Writes are never retried automatically: a retry could repeat a side effect. Safe
      // retries are the user's explicit choice, using the same idempotency key.
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** A fresh client per server render; one shared client in the browser. */
export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
