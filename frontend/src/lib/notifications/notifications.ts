/** How a notification reads and where it leads; the destination page enforces its own permissions. */
import { messages } from "../../messages/index.ts";
import { supportDestination } from "../support/support.ts";

const text = messages.notifications;

export interface Destination {
  href: string;
  label: string;
}

export interface TargetLike {
  target_kind: string | null;
  target_id: string | null;
}

export interface MembershipRole {
  role: string;
}

const STAFF = ["company_admin", "sales"];

/** The page a notification opens, or null when it names nothing this app can open; staff go to the company's view, everyone else to their own. */
export function destinationFor(notification: TargetLike, memberships: readonly MembershipRole[]): Destination | null {
  if (notification.target_kind === "support_case" && notification.target_id) {
    const roles = memberships.map((membership) => membership.role);
    return { href: `${supportDestination(roles)}/${notification.target_id}`, label: text.openSupport };
  }
  if (notification.target_kind === "request" && notification.target_id) {
    return { href: `/my/requests/${notification.target_id}`, label: text.openRequest };
  }
  if (notification.target_kind === "site_visit" && notification.target_id) {
    return { href: `/technician/visits/${notification.target_id}`, label: text.openVisit };
  }
  if (notification.target_kind !== "installation" || !notification.target_id) return null;
  const staff = memberships.some((membership) => STAFF.includes(membership.role));
  return staff
    ? { href: `/company/installations/${notification.target_id}`, label: text.openCompany }
    : { href: `/my/installations/${notification.target_id}`, label: text.open };
}

export type Filter = "all" | "unread";

export function parseFilter(value: string | null | undefined): Filter {
  return value === "unread" ? "unread" : "all";
}

export const NOTIFICATIONS_PAGE_SIZE = 20;
