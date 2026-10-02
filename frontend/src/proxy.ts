import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed middleware to proxy.
const requiresSignIn = createRouteMatcher(["/account(.*)", "/my(.*)", "/company(.*)", "/notifications(.*)", "/admin(.*)"]);

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
