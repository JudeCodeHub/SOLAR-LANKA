"use client";

import { useMemo } from "react";

import { deriveSessionState, type SessionState } from "@/lib/session";

import { useCurrentUser } from "./hooks";

/**
 * The interpreted state of the signed-in user (see lib/session.ts). `signedIn` comes from Clerk
 * or from the server render. Use this rather than reading the profile query directly, so every
 * screen treats a rejected session or suspended account the same way.
 */
export function useSessionState(signedIn: boolean) {
  const query = useCurrentUser({ enabled: signedIn });
  const state: SessionState = useMemo(
    () => deriveSessionState({ signedIn, profile: query.data, error: query.error }),
    [signedIn, query.data, query.error],
  );
  return { state, query };
}
