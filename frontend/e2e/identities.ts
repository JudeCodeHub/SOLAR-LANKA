/**
 * The controlled demo identities. Each is a fictional person created by the backend seed
 * (`python -m app.seed_demo` and `python -m app.seed_e2e`) and signed in by the test gateway,
 * so no real Clerk account or password is involved.
 */
export interface Identity {
  /** The Clerk subject the backend keys the account on. */
  subject: string;
  /** What GET /users/me must report for this person. */
  role: "customer" | "platform_admin";
  company: { name: string; role: "company_admin" | "sales" | "technician" } | null;
}

export const SUNBIRD = "Demo Sunbird Solar (Fictional)";
export const MOONLEAF = "Demo Moonleaf Energy (Fictional)";
export const LOTUS = "Demo Lotus Solar (Fictional)";
/** Serves the same district as Sunbird, so the two can compete for one request. */
export const RIVAL = "E2E Rival Solar (Fictional)";

export const IDENTITIES = {
  /** Owns the four seeded requests: a draft offer, a revised offer, an expired offer and an accepted offer with an installation. */
  customer: { subject: "demo_seed_customer", role: "customer", company: null },
  /** Has no requests, estimates or installations: every empty state. */
  newCustomer: { subject: "e2e_customer_new", role: "customer", company: null },
  /** Saves estimates and sends requests in browser tests, so the other customers stay untouched. */
  estimateCustomer: { subject: "e2e_customer_estimate", role: "customer", company: null },
  /** Owns nothing of the demo customer's: used to prove other people's records stay hidden. */
  otherCustomer: { subject: "e2e_customer_two", role: "customer", company: null },
  sunbirdAdmin: { subject: "demo_seed_company_a", role: "customer", company: { name: SUNBIRD, role: "company_admin" } },
  sunbirdSales: { subject: "e2e_sunbird_sales", role: "customer", company: { name: SUNBIRD, role: "sales" } },
  sunbirdTechnician: { subject: "e2e_sunbird_technician", role: "customer", company: { name: SUNBIRD, role: "technician" } },
  moonleafAdmin: { subject: "demo_seed_company_b", role: "customer", company: { name: MOONLEAF, role: "company_admin" } },
  rivalAdmin: { subject: "e2e_rival_admin", role: "customer", company: { name: RIVAL, role: "company_admin" } },
  lotusAdmin: { subject: "demo_seed_company_c", role: "customer", company: { name: LOTUS, role: "company_admin" } },
  platformAdmin: { subject: "e2e_platform_admin", role: "platform_admin", company: null },
} as const satisfies Record<string, Identity>;

export type IdentityName = keyof typeof IDENTITIES;
