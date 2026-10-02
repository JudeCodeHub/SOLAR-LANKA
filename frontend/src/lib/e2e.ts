/** Browser tests sign in through a test-only gateway identity; this is the one switch that allows it, and never in production. */
export function authBypass(env: Record<string, string | undefined>): boolean {
  return env.E2E_AUTH === "1" && env.NODE_ENV !== "production";
}
