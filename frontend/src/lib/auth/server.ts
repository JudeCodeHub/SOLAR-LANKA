import "server-only";

import { auth } from "@clerk/nextjs/server";

export type CurrentIdentity =
  | { isSignedIn: false }
  | { isSignedIn: true; userId: string; sessionId: string };

/** The verified Clerk identity for the current request. */
export async function getCurrentIdentity(): Promise<CurrentIdentity> {
  const { isAuthenticated, userId, sessionId } = await auth();
  if (!isAuthenticated || !userId || !sessionId) {
    return { isSignedIn: false };
  }
  return { isSignedIn: true, userId, sessionId };
}

/** A short-lived session token for one backend request. */
export async function getBackendToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}
