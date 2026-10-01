/**
 * What the application shell shows each kind of user.
 *
 * Pure data and functions with no framework imports, so the rules can be unit tested. The
 * registry lists every planned destination, but only items marked `available` are rendered,
 * so the menu never links to a page that does not exist or presents unfinished work as
 * finished. src/lib/navigation.test.ts fails if `available` disagrees with the real routes
 * under src/app, which forces this file to be updated in the same change as a new page.
 *
 * Visibility mirrors the backend permission matrix (backend/app/core/permissions.py) so users
 * are offered what they can actually do. It is a convenience only: hiding a link never
 * protects anything, and FastAPI re-checks every operation.
 */

export type AccountRole = "customer" | "platform_admin";
export type CompanyRole = "company_admin" | "sales" | "technician";

/** The signed-in user as the shell sees it, built from GET /users/me. */
export interface ShellUser {
  role: AccountRole;
  memberships: readonly { companyId: string; role: CompanyRole }[];
}

export type NavAccess =
  | { kind: "public" }
  | { kind: "signed-in" }
  | { kind: "account-role"; role: AccountRole }
  | { kind: "company-role"; roles: readonly CompanyRole[] };

export type NavGroupId = "explore" | "customer" | "company" | "admin" | "account";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  group: NavGroupId;
  access: NavAccess;
  /** True only when a page exists at `href`. Enforced by a test. */
  available: boolean;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  items: readonly NavItem[];
}

const GROUP_ORDER: readonly NavGroupId[] = ["explore", "customer", "company", "admin", "account"];

const GROUP_LABELS: Record<NavGroupId, string> = {
  explore: "Explore",
  customer: "My activity",
  company: "Company workspace",
  admin: "Administration",
  account: "Account",
};

const PUBLIC: NavAccess = { kind: "public" };
const CUSTOMER: NavAccess = { kind: "account-role", role: "customer" };
const PLATFORM_ADMIN: NavAccess = { kind: "account-role", role: "platform_admin" };
// Company administrators and sales staff. Technicians get their own area with the technician
// workspace; until it exists they have no company links.
const COMPANY_STAFF: NavAccess = { kind: "company-role", roles: ["company_admin", "sales"] };

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/", group: "explore", access: PUBLIC, available: true },
  { id: "panels", label: "Solar panels", href: "/panels", group: "explore", access: PUBLIC, available: false },
  { id: "inverters", label: "Inverters", href: "/inverters", group: "explore", access: PUBLIC, available: false },
  { id: "estimator", label: "Estimator", href: "/estimator", group: "explore", access: PUBLIC, available: false },
  { id: "companies", label: "Companies", href: "/companies", group: "explore", access: PUBLIC, available: false },
  { id: "learn", label: "Learning centre", href: "/learn", group: "explore", access: PUBLIC, available: false },
  { id: "troubleshooting", label: "Troubleshooting", href: "/troubleshooting", group: "explore", access: PUBLIC, available: false },
  { id: "support", label: "Support", href: "/support", group: "explore", access: PUBLIC, available: false },

  { id: "my-estimates", label: "My estimates", href: "/my/estimates", group: "customer", access: CUSTOMER, available: false },
  { id: "my-requests", label: "My requests", href: "/my/requests", group: "customer", access: CUSTOMER, available: false },
  { id: "my-installations", label: "My installations", href: "/my/installations", group: "customer", access: CUSTOMER, available: false },
  { id: "my-favourites", label: "Favourites", href: "/my/favourites", group: "customer", access: CUSTOMER, available: false },

  { id: "company-inbox", label: "Request inbox", href: "/company/inbox", group: "company", access: COMPANY_STAFF, available: false },
  { id: "company-offers", label: "Product offers", href: "/company/offers", group: "company", access: COMPANY_STAFF, available: false },
  { id: "company-installations", label: "Installations", href: "/company/installations", group: "company", access: COMPANY_STAFF, available: false },
  { id: "company-profile", label: "Company profile", href: "/company/profile", group: "company", access: COMPANY_STAFF, available: false },

  { id: "admin-companies", label: "Company reviews", href: "/admin/companies", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-catalogue", label: "Catalogue", href: "/admin/catalogue", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-estimator", label: "Estimator settings", href: "/admin/estimator", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-users", label: "Users", href: "/admin/users", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-activity", label: "Activity and audit", href: "/admin/activity", group: "admin", access: PLATFORM_ADMIN, available: false },

  { id: "account", label: "Account", href: "/account", group: "account", access: { kind: "signed-in" }, available: true },
  { id: "notifications", label: "Notifications", href: "/notifications", group: "account", access: { kind: "signed-in" }, available: false },
];

/** `user` is null for a signed-out visitor, and also while a signed-in user's profile loads. */
export function canSee(item: NavItem, user: ShellUser | null, signedIn: boolean): boolean {
  const access = item.access;
  switch (access.kind) {
    case "public":
      return true;
    case "signed-in":
      return signedIn;
    case "account-role":
      return user?.role === access.role;
    case "company-role":
      return (
        user !== null && user.memberships.some((membership) => access.roles.includes(membership.role))
      );
  }
}

/**
 * The groups of links this user should see, in a fixed order, omitting empty groups and any
 * destination that is not built yet.
 */
export function navigationFor(
  user: ShellUser | null,
  signedIn: boolean,
  items: readonly NavItem[] = NAV_ITEMS,
): NavGroup[] {
  return GROUP_ORDER.map((id) => ({
    id,
    label: GROUP_LABELS[id],
    items: items.filter(
      (item) => item.group === id && item.available && canSee(item, user, signedIn),
    ),
  })).filter((group) => group.items.length > 0);
}

/** A link is active on its own page and anywhere below it; "/" matches only itself. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface CurrentUserPayload {
  role: AccountRole;
  memberships: readonly { company_id: string; role: CompanyRole }[];
}

/** Map the GET /users/me response to the shell's view of the user. */
export function toShellUser(profile: CurrentUserPayload): ShellUser {
  return {
    role: profile.role,
    memberships: profile.memberships.map((membership) => ({
      companyId: membership.company_id,
      role: membership.role,
    })),
  };
}
