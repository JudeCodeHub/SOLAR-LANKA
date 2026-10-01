import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed middleware to proxy. clerkMiddleware verifies the session cookie and
// makes the identity available to server code through auth(). It does not block routes by
// itself; route and role checks are added with the role-aware navigation, and the FastAPI
// backend enforces authorisation on every protected operation regardless.
export default clerkMiddleware();

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
