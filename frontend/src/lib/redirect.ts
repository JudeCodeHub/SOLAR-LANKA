/**
 * Where to send someone back to after they sign in again. Only paths on this site are allowed,
 * so a crafted address can never turn the sign-in page into an open redirect.
 */
const AUTH_PATHS = ["/sign-in", "/sign-up"];

/** A same-site path to return to, or "/" when the given one is missing or unsafe. */
export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/";
  }
  if (/[\u0000-\u001f\u007f]/.test(path)) {
    return "/";
  }
  if (AUTH_PATHS.some((auth) => path === auth || path.startsWith(`${auth}/`))) {
    return "/";
  }
  return path;
}

/** The sign-in address that returns to `path` afterwards. */
export function signInHref(path: string | null | undefined): string {
  const target = safeReturnPath(path);
  return target === "/" ? "/sign-in" : `/sign-in?redirect_url=${encodeURIComponent(target)}`;
}
