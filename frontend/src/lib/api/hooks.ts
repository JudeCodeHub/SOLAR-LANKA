"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";

import { createBrowserApi } from "./client";
import { unwrap } from "./errors";

const api = createBrowserApi();

/** The application's record of the signed-in user (role, creation date). */
export function useCurrentUser({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => unwrap(() => api.GET("/users/me")),
    enabled,
  });
}
