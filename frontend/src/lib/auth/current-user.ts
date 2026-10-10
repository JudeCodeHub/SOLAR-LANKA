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

/** Who is signed in and which area is theirs, asked once per request; `unavailable` must never be treated as allowed. */
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
