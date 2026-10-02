import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { authBypass } from "./lib/e2e";

// Next.js 16 renamed middleware to proxy.
const requiresSignIn = createRouteMatcher(["/account(.*)", "/my(.*)", "/company(.*)", "/notifications(.*)", "/admin(.*)", "/technician(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Only browser tests with E2E_AUTH=1 outside production skip the sign-in; the API still verifies every token.
  if (requiresSignIn(request) && !authBypass(process.env)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Always run for Clerk's frontend API routes.
    "/__clerk/(.*)",
  ],
};
