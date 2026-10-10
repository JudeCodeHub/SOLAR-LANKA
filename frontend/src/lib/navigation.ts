/** What the application shell shows each kind of user. */

import { messages } from "../messages/index.ts";

export type AccountRole = "customer" | "platform_admin";
export type CompanyRole = "company_admin" | "sales" | "technician";

/** The signed-in user as the shell sees it, built from GET /users/me. */
export interface ShellUser {
  role: AccountRole;
  memberships: readonly { companyId: string; role: CompanyRole }[];
}

export type NavAccess = { kind: "signed-in" } | { kind: "persona"; personas: readonly Persona[] };

/** Which sidebar a signed-in person gets: one persona each, so company staff do not also see the customer's categories. */
export type Persona = "customer" | "company" | "technician" | "admin";

// ---- The signed-in sidebar: categories with sub-items ------------------------------------------------

export type CategoryId =
  | "overview"
  | "plan"
  | "catalogue"
  | "installers"
  | "requests"
  | "offers"
  | "installation"
  | "visits"
  | "review"
  | "content"
  | "settings"
  | "people"
  | "audit"
  | "company"
  | "learn"
  | "help"
  | "account";

/** One link in the sidebar: the id also picks its icon, and `access` says who is shown it. */
export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  access: NavAccess;
  /** False while the page is not built; such an item is left out of the sidebar. */
  available: boolean;
}

export interface SidebarCategory {
  id: CategoryId;
  label: string;
  items: readonly SidebarItem[];
  /** True for a category whose pages are reached from the top strip (the bell, the account menu) and are not listed in the sidebar; they still give the page its breadcrumbs. */
  hidden?: boolean;
}

const SIGNED_IN: NavAccess = { kind: "signed-in" };
const FOR = (...personas: Persona[]): NavAccess => ({ kind: "persona", personas });
const AS_CUSTOMER = FOR("customer");
const AS_COMPANY = FOR("company");
const AS_TECHNICIAN = FOR("technician");
const AS_ADMIN = FOR("admin");
const NOT_ADMIN = FOR("customer", "company", "technician");
const CATEGORY_LABELS: Record<CategoryId, string> = messages.nav.categories;
const item = (id: string, label: string, href: string, access: NavAccess, available = true): SidebarItem => ({ id, label, href, access, available });

/** Every sidebar link, once, grouped into categories. */
export const SIDEBAR: readonly SidebarCategory[] = [
  {
    id: "overview",
    label: CATEGORY_LABELS.overview,
    items: [
      item("my-dashboard", messages.nav.items.myDashboard, "/my", AS_CUSTOMER),
      item("company-dashboard", messages.nav.items.companyDashboard, "/company", AS_COMPANY),
      item("technician-visits", messages.nav.items.technicianVisits, "/technician", AS_TECHNICIAN),
      item("admin-home", messages.nav.items.adminHome, "/admin", AS_ADMIN),
    ],
  },
  {
    id: "plan",
    label: CATEGORY_LABELS.plan,
    items: [
      item("estimator", messages.nav.items.estimator, "/estimator", AS_CUSTOMER),
      item("my-estimates", messages.nav.items.myEstimates, "/my/estimates", AS_CUSTOMER),
      item("my-favourites", messages.nav.items.myFavourites, "/my/favourites", AS_CUSTOMER),
    ],
  },
  {
    id: "catalogue",
    label: CATEGORY_LABELS.catalogue,
    items: [
      item("panels", messages.nav.items.panels, "/panels", AS_CUSTOMER),
      item("inverters", messages.nav.items.inverters, "/inverters", AS_CUSTOMER),
      item("compare-panels", messages.nav.items.comparePanels, "/panels/compare", AS_CUSTOMER),
      item("compare-inverters", messages.nav.items.compareInverters, "/inverters/compare", AS_CUSTOMER),
    ],
  },
  {
    id: "installers",
    label: CATEGORY_LABELS.installers,
    items: [
      item("companies", messages.nav.items.companies, "/companies", AS_CUSTOMER),
      item("my-requests", messages.nav.items.myRequests, "/my/requests", AS_CUSTOMER),
      item("new-request", messages.nav.items.newRequest, "/my/requests/new", AS_CUSTOMER),
    ],
  },
  {
    id: "requests",
    label: CATEGORY_LABELS.requests,
    items: [item("company-inbox", messages.nav.items.companyInbox, "/company/inbox", AS_COMPANY)],
  },
  {
    id: "offers",
    label: CATEGORY_LABELS.offers,
    items: [item("company-offers", messages.nav.items.companyOffers, "/company/offers", AS_COMPANY)],
  },
  {
    id: "installation",
    label: CATEGORY_LABELS.installation,
    items: [
      item("my-installations", messages.nav.items.myInstallations, "/my/installations", AS_CUSTOMER),
      item("company-installations", messages.nav.items.companyInstallations, "/company/installations", AS_COMPANY),
    ],
  },
  {
    id: "company",
    label: CATEGORY_LABELS.company,
    items: [item("company-profile", messages.nav.items.companyProfile, "/company/profile", AS_COMPANY)],
  },
  {
    id: "review",
    label: CATEGORY_LABELS.review,
    items: [item("admin-companies", messages.nav.items.adminCompanies, "/admin/companies", AS_ADMIN)],
  },
  {
    id: "content",
    label: CATEGORY_LABELS.content,
    items: [
      item("admin-catalogue", messages.nav.items.adminCatalogue, "/admin/catalogue", AS_ADMIN),
      item("admin-education", messages.nav.items.adminEducation, "/admin/education", AS_ADMIN),
      item("admin-troubleshooting", messages.nav.items.adminTroubleshooting, "/admin/troubleshooting", AS_ADMIN),
    ],
  },
  {
    id: "settings",
    label: CATEGORY_LABELS.settings,
    items: [item("admin-estimator", messages.nav.items.adminEstimator, "/admin/estimator", AS_ADMIN)],
  },
  {
    id: "people",
    label: CATEGORY_LABELS.people,
    items: [item("admin-users", messages.nav.items.adminUsers, "/admin/users", AS_ADMIN)],
  },
  {
    id: "audit",
    label: CATEGORY_LABELS.audit,
    items: [item("admin-activity", messages.nav.items.adminActivity, "/admin/activity", AS_ADMIN)],
  },
  {
    id: "learn",
    label: CATEGORY_LABELS.learn,
    items: [
      item("learn", messages.nav.items.learn, "/learn", NOT_ADMIN),
      item("troubleshooting", messages.nav.items.troubleshooting, "/troubleshooting", NOT_ADMIN),
    ],
  },
  {
    id: "help",
    label: CATEGORY_LABELS.help,
    items: [
      item("my-support", messages.nav.items.mySupport, "/my/support", AS_CUSTOMER),
      item("company-support", messages.nav.items.companySupport, "/company/support", AS_COMPANY),
      item("technician-support", messages.nav.items.technicianSupport, "/technician/support", AS_TECHNICIAN),
      item("safety-help", messages.nav.items.safetyHelp, "/support", NOT_ADMIN),
    ],
  },
  {
    id: "account",
    label: CATEGORY_LABELS.account,
    hidden: true,
    items: [
      item("notifications", messages.nav.items.notifications, "/notifications", SIGNED_IN),
      item("account", messages.nav.items.account, "/account", SIGNED_IN),
    ],
  },
];

/** `user` is null for a signed-out visitor, and also while a signed-in user's profile loads. */
export function canSee(item: { access: NavAccess }, user: ShellUser | null, signedIn: boolean): boolean {
  const access = item.access;
  switch (access.kind) {
    case "signed-in":
      return signedIn;
    case "persona":
      return user !== null && access.personas.includes(personaOf(user));
  }
}

/** Platform administrators first, then company staff (administrator or sales), then technicians; everyone else is a customer. */
export function personaOf(user: ShellUser): Persona {
  if (user.role === "platform_admin") return "admin";
  if (user.memberships.some((membership) => membership.role === "company_admin" || membership.role === "sales")) return "company";
  if (user.memberships.some((membership) => membership.role === "technician")) return "technician";
  return "customer";
}

/** The sidebar categories this person may see, in tree order, each with only the links that are theirs and built. */
export function sidebarFor(user: ShellUser | null, signedIn: boolean, categories: readonly SidebarCategory[] = SIDEBAR): SidebarCategory[] {
  return categories
    .map((category) => ({ ...category, items: category.items.filter((entry) => entry.available && canSee(entry, user, signedIn)) }))
    .filter((category) => category.items.length > 0);
}

export interface CurrentPlace {
  category: SidebarCategory;
  item: SidebarItem;
  /** The names from the category down to the page, for the page title and the breadcrumbs. */
  trail: readonly string[];
}

/** Which sidebar category and link an address belongs to: the link with the longest matching address wins, so a deeper link is preferred over the page above it; null for an address that is in none (such as the landing page). */
export function locate(pathname: string, categories: readonly SidebarCategory[]): CurrentPlace | null {
  let best: CurrentPlace | null = null;
  let length = -1;
  for (const category of categories) {
    for (const entry of category.items) {
      if (isActive(entry.href, pathname) && entry.href.length > length) {
        best = { category, item: entry, trail: [category.label, entry.label] };
        length = entry.href.length;
      }
    }
  }
  return best;
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
