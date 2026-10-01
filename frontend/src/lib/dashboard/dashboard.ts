/** What each dashboard asks a person to do next, in priority order, from counts that may still be loading. */
import { format, messages, plural } from "../../messages/index.ts";

const text = messages.dashboard;

export interface Action {
  id: string;
  label: string;
  href: string;
}

export interface CustomerSummary {
  totalRequests?: number;
  activeRequests?: number;
  openOffers?: number;
  expiringSoon?: number;
  /** The request holding the offer that ends soonest, so the link goes straight to it. */
  urgentRequestId?: string | null;
  installationsInProgress?: number;
  unread?: number;
}

/** The customer's next steps; a count that is not known yet never produces an action. */
export function customerActions(s: CustomerSummary): Action[] {
  const actions: Action[] = [];
  const count = (n: number | undefined) => n ?? 0;
  if (count(s.expiringSoon) > 0) {
    actions.push({
      id: "expiring",
      label: format(plural(text.customer.expiring, count(s.expiringSoon)), { count: count(s.expiringSoon) }),
      href: s.urgentRequestId ? `/my/requests/${s.urgentRequestId}` : "/my/requests",
    });
  }
  if (count(s.openOffers) > 0) {
    actions.push({ id: "offers", label: format(plural(text.customer.offers, count(s.openOffers)), { count: count(s.openOffers) }), href: "/my/requests" });
  }
  if (count(s.unread) > 0) {
    actions.push({ id: "unread", label: format(plural(text.unread, count(s.unread)), { count: count(s.unread) }), href: "/notifications?filter=unread" });
  }
  if (count(s.installationsInProgress) > 0) {
    actions.push({ id: "installations", label: text.customer.installations, href: "/my/installations" });
  }
  if (s.totalRequests === 0) {
    actions.push({ id: "estimate", label: text.customer.estimate, href: "/estimator" });
    actions.push({ id: "request", label: text.customer.request, href: "/my/requests/new" });
  } else if (count(s.activeRequests) > 0 && count(s.openOffers) === 0) {
    actions.push({ id: "follow", label: text.customer.follow, href: "/my/requests" });
  }
  return actions;
}

export interface CompanySummary {
  profileStatus?: string;
  newEnquiries?: number;
  offerCount?: number;
  installationsInProgress?: number;
  unread?: number;
}

/** The company's next steps, for the company already chosen. */
export function companyActions(s: CompanySummary, companyId: string): Action[] {
  const actions: Action[] = [];
  const count = (n: number | undefined) => n ?? 0;
  if (s.profileStatus === "draft" || s.profileStatus === "rejected") {
    actions.push({ id: "profile", label: s.profileStatus === "rejected" ? text.company.profileRejected : text.company.profileDraft, href: `/company/profile?company=${companyId}` });
  }
  if (count(s.newEnquiries) > 0) {
    actions.push({ id: "enquiries", label: format(plural(text.company.enquiries, count(s.newEnquiries)), { count: count(s.newEnquiries) }), href: `/company/inbox?company=${companyId}` });
  }
  if (count(s.installationsInProgress) > 0) {
    actions.push({ id: "installations", label: format(plural(text.company.installations, count(s.installationsInProgress)), { count: count(s.installationsInProgress) }), href: `/company/installations?company=${companyId}` });
  }
  if (s.offerCount === 0) {
    actions.push({ id: "offers", label: text.company.addOffers, href: "/company/offers" });
  }
  if (count(s.unread) > 0) {
    actions.push({ id: "unread", label: format(plural(text.unread, count(s.unread)), { count: count(s.unread) }), href: "/notifications?filter=unread" });
  }
  return actions;
}
