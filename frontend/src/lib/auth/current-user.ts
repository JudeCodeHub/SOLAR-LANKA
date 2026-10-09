import "server-only";

import { cache } from "react";

import { serverApi } from "@/lib/api/server";
import { getCurrentIdentity } from "@/lib/auth/server";
import { type Persona, personaOf, type ShellUser, toShellUser } from "@/lib/navigation";

/** Where each kind of person starts: the home page of their own area. */
export const HOME_PATH: Record<Persona, string> = {
  customer: "/my",
  company: "/company",
  technician: "/technician",
  admin: "/admin",
};

export type CurrentUser =
  | { status: "signed-out" }
  | { status: "unavailable" }
  | { status: "ready"; user: ShellUser; persona: Persona; home: string };

/**
 * Who the signed-in person is and which area is theirs, asked of the API once per request, so a layout and its pages can all use it without extra calls.
 * `signed-out` means there is no session; `unavailable` means there is a session but the API could not say (down, or the profile is not ready), which a caller must treat as "do not decide", never as "allowed".
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const identity = await getCurrentIdentity();
  if (!identity.isSignedIn) return { status: "signed-out" };
  try {
    const api = await serverApi();
    const { data } = await api.GET("/users/me");
    if (!data) return { status: "unavailable" };
    const user = toShellUser(data);
    const persona = personaOf(user);
    return { status: "ready", user, persona, home: HOME_PATH[persona] };
  } catch {
    return { status: "unavailable" };
  }
});
