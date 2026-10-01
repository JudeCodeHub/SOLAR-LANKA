"use client";

import { useMemo } from "react";

import { type NavGroup, navigationFor } from "@/lib/navigation";
import { navigationUser } from "@/lib/session";

import { useSessionState } from "./use-session";

/**
 * The navigation groups for the current user. `signedIn` comes from the server render so the
 * first paint already knows whether to show account links; role-specific links appear once the
 * profile (role and company memberships) has loaded, and disappear again if the backend stops
 * accepting the session or the account is suspended.
 */
export function useNavigation(signedIn: boolean): NavGroup[] {
  const { state } = useSessionState(signedIn);
  const user = navigationUser(state);
  return useMemo(() => navigationFor(user, signedIn), [user, signedIn]);
}
