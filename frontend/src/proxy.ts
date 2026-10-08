import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed middleware to proxy.
// Signed-out visitors may see only the landing page, the sign-in and sign-up pages and the site's icons and share images; every other address needs a session, and the API still checks each token and each role.
const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/manifest.webmanifest", "/icon(.*)", "/apple-icon(.*)", "/opengraph-image(.*)", "/twitter-image(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) {
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
