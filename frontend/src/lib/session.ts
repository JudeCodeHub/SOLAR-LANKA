/** How the interface interprets the state of the signed-in user. */
import type { ApiError } from "./api/errors.ts";
import { type AccountRole, type CompanyRole, type ShellUser, toShellUser } from "./navigation.ts";

interface ProfilePayload {
  role: AccountRole;
  memberships: readonly { company_id: string; role: CompanyRole }[];
}

export type SessionState =
  /** Clerk reports no session. */
  | { status: "signed-out" }
  /** Signed in; the profile has not arrived yet. */
  | { status: "loading" }
  | { status: "ready"; user: ShellUser }
  /** The backend refuses the account (403): suspended or no longer active. */
  | { status: "inactive" }
  /** The backend does not accept the session (401) although Clerk is signed in. */
  | { status: "rejected" }
  /** The profile could not be loaded for another reason (backend unreachable, server error). */
  | { status: "unavailable"; user: ShellUser | null };

export function deriveSessionState(input: {
  signedIn: boolean;
  profile: ProfilePayload | undefined;
  error: ApiError | null;
}): SessionState {
  if (!input.signedIn) {
    return { status: "signed-out" };
  }
  if (input.error) {
    // An authorisation failure invalidates whatever was cached, even if data is still present.
    if (input.error.status === 403) return { status: "inactive" };
    if (input.error.status === 401) return { status: "rejected" };
    return { status: "unavailable", user: input.profile ? toShellUser(input.profile) : null };
  }
  if (input.profile) {
    return { status: "ready", user: toShellUser(input.profile) };
  }
  return { status: "loading" };
}

/** The user to build navigation for, or null when nothing about the user can be trusted. */
export function navigationUser(state: SessionState): ShellUser | null {
  return state.status === "ready" || state.status === "unavailable" ? state.user : null;
}

/** Whether client-side state must be discarded because the person using the browser changed. */
export function shouldResetClientState(
  previousUserId: string | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  if (previousUserId === undefined || currentUserId === undefined) {
    return false;
  }
  return previousUserId !== currentUserId;
}
