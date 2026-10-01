import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed middleware to proxy. clerkMiddleware verifies the session cookie and
// makes the identity available to server code through auth().
//
// Only routes listed here are gated, and only for convenience: signed-out visitors are sent
// to sign in instead of seeing an empty page. This is not authorisation. The FastAPI backend
// enforces roles, company scope and ownership on every operation regardless.
const requiresSignIn = createRouteMatcher(["/account(.*)", "/my(.*)", "/company(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (requiresSignIn(request)) {
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
