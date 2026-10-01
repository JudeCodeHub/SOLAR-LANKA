"use client";

import { useMemo } from "react";

import { type NavGroup, navigationFor } from "@/lib/navigation";
import { navigationUser } from "@/lib/session";

import { useSessionState } from "./use-session";

/** The navigation groups for the current user. */
export function useNavigation(signedIn: boolean): NavGroup[] {
  const { state } = useSessionState(signedIn);
  const user = navigationUser(state);
  return useMemo(() => navigationFor(user, signedIn), [user, signedIn]);
}
