import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { serverApi } from "@/lib/api/server";

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  platform_admin: "Platform administrator",
};

type Outcome =
  | { kind: "ok"; role: string; createdAt: string }
  | { kind: "problem"; message: string };

async function loadProfile(): Promise<Outcome> {
  try {
    const api = await serverApi();
    const { data, response } = await api.GET("/users/me");
    if (data) {
      return { kind: "ok", role: data.role, createdAt: data.created_at };
    }
    if (response.status === 401) {
      return {
        kind: "problem",
        message:
          "The API did not accept your session. Check that the backend's Clerk issuer and authorised parties match this app.",
      };
    }
    if (response.status === 403) {
      return { kind: "problem", message: "This account is suspended." };
    }
    return { kind: "problem", message: "The API could not load your account right now." };
  } catch {
    return { kind: "problem", message: "The API is unavailable right now." };
  }
}

/** The application's own record of the signed-in user, loaded from FastAPI with their identity. */
export async function BackendProfile() {
  const outcome = await loadProfile();
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Application account</CardTitle>
        <CardDescription>
          Your role and access are decided by the platform, not by your sign-in provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {outcome.kind === "ok" ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted-foreground">Role</dt>
            <dd data-testid="backend-role">{ROLE_LABELS[outcome.role] ?? outcome.role}</dd>
            <dt className="text-muted-foreground">Account created</dt>
            <dd>{new Date(outcome.createdAt).toLocaleDateString("en-GB", { dateStyle: "long" })}</dd>
          </dl>
        ) : (
          <p role="status" className="text-destructive">
            {outcome.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
