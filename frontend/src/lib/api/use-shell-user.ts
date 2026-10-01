"use client";

import { useMemo } from "react";

import { type NavGroup, navigationFor, toShellUser } from "@/lib/navigation";

import { useCurrentUser } from "./hooks";

/**
 * The navigation groups for the current user. `signedIn` comes from the server render so the
 * first paint already knows whether to show account links; role-specific links appear once the
 * profile (role and company memberships) has loaded, and never for a failed or pending load.
 */
export function useNavigation(signedIn: boolean): NavGroup[] {
  const query = useCurrentUser({ enabled: signedIn });
  const user = useMemo(() => (query.data ? toShellUser(query.data) : null), [query.data]);
  return useMemo(() => navigationFor(user, signedIn), [user, signedIn]);
}
