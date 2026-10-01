/** What the application shell shows each kind of user. */

import { messages } from "../messages/index.ts";

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

const GROUP_LABELS: Record<NavGroupId, string> = messages.nav.groups;

const PUBLIC: NavAccess = { kind: "public" };
const CUSTOMER: NavAccess = { kind: "account-role", role: "customer" };
const PLATFORM_ADMIN: NavAccess = { kind: "account-role", role: "platform_admin" };
// Company administrators and sales staff.
const COMPANY_STAFF: NavAccess = { kind: "company-role", roles: ["company_admin", "sales"] };

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: messages.nav.items.home, href: "/", group: "explore", access: PUBLIC, available: true },
  { id: "panels", label: messages.nav.items.panels, href: "/panels", group: "explore", access: PUBLIC, available: true },
  { id: "inverters", label: messages.nav.items.inverters, href: "/inverters", group: "explore", access: PUBLIC, available: true },
  { id: "estimator", label: messages.nav.items.estimator, href: "/estimator", group: "explore", access: PUBLIC, available: true },
  { id: "companies", label: messages.nav.items.companies, href: "/companies", group: "explore", access: PUBLIC, available: true },
  { id: "learn", label: messages.nav.items.learn, href: "/learn", group: "explore", access: PUBLIC, available: false },
  { id: "troubleshooting", label: messages.nav.items.troubleshooting, href: "/troubleshooting", group: "explore", access: PUBLIC, available: false },
  { id: "support", label: messages.nav.items.support, href: "/support", group: "explore", access: PUBLIC, available: false },

  { id: "my-estimates", label: messages.nav.items.myEstimates, href: "/my/estimates", group: "customer", access: CUSTOMER, available: true },
  { id: "my-requests", label: messages.nav.items.myRequests, href: "/my/requests", group: "customer", access: CUSTOMER, available: true },
  { id: "my-installations", label: messages.nav.items.myInstallations, href: "/my/installations", group: "customer", access: CUSTOMER, available: false },
  { id: "my-favourites", label: messages.nav.items.myFavourites, href: "/my/favourites", group: "customer", access: CUSTOMER, available: true },

  { id: "company-inbox", label: messages.nav.items.companyInbox, href: "/company/inbox", group: "company", access: COMPANY_STAFF, available: true },
  { id: "company-offers", label: messages.nav.items.companyOffers, href: "/company/offers", group: "company", access: COMPANY_STAFF, available: true },
  { id: "company-installations", label: messages.nav.items.companyInstallations, href: "/company/installations", group: "company", access: COMPANY_STAFF, available: false },
  { id: "company-profile", label: messages.nav.items.companyProfile, href: "/company/profile", group: "company", access: COMPANY_STAFF, available: true },

  { id: "admin-companies", label: messages.nav.items.adminCompanies, href: "/admin/companies", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-catalogue", label: messages.nav.items.adminCatalogue, href: "/admin/catalogue", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-estimator", label: messages.nav.items.adminEstimator, href: "/admin/estimator", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-users", label: messages.nav.items.adminUsers, href: "/admin/users", group: "admin", access: PLATFORM_ADMIN, available: false },
  { id: "admin-activity", label: messages.nav.items.adminActivity, href: "/admin/activity", group: "admin", access: PLATFORM_ADMIN, available: false },

  { id: "account", label: messages.nav.items.account, href: "/account", group: "account", access: { kind: "signed-in" }, available: true },
  { id: "notifications", label: messages.nav.items.notifications, href: "/notifications", group: "account", access: { kind: "signed-in" }, available: false },
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

/** The groups of links this user should see, in a fixed order. */
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

export interface EntryPoint {
  id: string;
  label: string;
  href: string;
  /** False while the page is not built; such an entry is shown but is not a link. */
  linkable: boolean;
}

/** The public destinations to advertise on the landing page, in menu order. */
export function publicEntryPoints(items: readonly NavItem[] = NAV_ITEMS): EntryPoint[] {
  return items
    .filter((item) => item.group === "explore" && item.access.kind === "public" && item.id !== "home")
    .map((item) => ({ id: item.id, label: item.label, href: item.href, linkable: item.available }));
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
