import "server-only";

import { auth } from "@clerk/nextjs/server";

export type CurrentIdentity =
  | { isSignedIn: false }
  | { isSignedIn: true; userId: string; sessionId: string };

/**
 * The verified Clerk identity for the current request. This only describes who the browser
 * is signed in as; it grants nothing. The backend maps the Clerk subject to a local user and
 * decides roles, company membership and ownership on every operation.
 */
export async function getCurrentIdentity(): Promise<CurrentIdentity> {
  const { isAuthenticated, userId, sessionId } = await auth();
  if (!isAuthenticated || !userId || !sessionId) {
    return { isSignedIn: false };
  }
  return { isSignedIn: true, userId, sessionId };
}

/**
 * A short-lived session token for one backend request. Clerk issues it on demand and owns the
 * session cookie. Never store the returned value (not in state, storage or a cache) and never
 * log it: request a fresh one each time.
 */
export async function getBackendToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}
