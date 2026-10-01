import { getCurrentIdentity } from "@/lib/auth/server";

/** Shows the verified sign-in state. Sign-in and sign-out controls arrive with 13.05. */
export async function AuthStatus() {
  const identity = await getCurrentIdentity();
  return (
    <p className="text-sm text-muted-foreground" data-testid="auth-status">
      {identity.isSignedIn ? "Signed in" : "Not signed in"}
    </p>
  );
}
