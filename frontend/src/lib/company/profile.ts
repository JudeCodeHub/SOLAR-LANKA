/**
 * Rules for the company profile screen. Pure functions, so they are tested without a browser.
 *
 * Who may manage a profile mirrors the backend: only an active company administrator or sales member
 * of that company. Which company is shown is always decided from the signed-in user's own
 * memberships, never from the address, so staff can only ever reach their own company.
 */
import { z } from "zod";

import { messages } from "../../messages/index.ts";
import { DISTRICTS, type District, SERVICES, type Service } from "../directory/options.ts";

export const STAFF_ROLES = ["company_admin", "sales"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type PublicationStatus = "draft" | "pending" | "approved" | "rejected";

export interface MembershipLike {
  company_id: string;
  company_name: string;
  role: string;
}

/** The companies this person may manage: those where they are a company administrator or sales. */
export function staffCompanies(memberships: readonly MembershipLike[]): MembershipLike[] {
  return memberships.filter((membership) => (STAFF_ROLES as readonly string[]).includes(membership.role));
}

export type Resolution =
  | { kind: "none"; technicianOnly: boolean }
  | { kind: "choose"; companies: MembershipLike[] }
  | { kind: "ok"; company: MembershipLike }
  /** The address named a company the person does not work for. */
  | { kind: "not-yours"; companies: MembershipLike[] };

/** Which company to show, from the user's own memberships and the (untrusted) address. */
export function resolveCompany(memberships: readonly MembershipLike[], requested: string | null): Resolution {
  const companies = staffCompanies(memberships);
  if (companies.length === 0) {
    return { kind: "none", technicianOnly: memberships.some((membership) => membership.role === "technician") };
  }
  if (requested) {
    const match = companies.find((company) => company.company_id === requested);
    return match ? { kind: "ok", company: match } : { kind: "not-yours", companies };
  }
  return companies.length === 1 ? { kind: "ok", company: companies[0] as MembershipLike } : { kind: "choose", companies };
}

export interface ProfileValues {
  name: string;
  service_districts: District[];
  services: Service[];
  declared_credentials: { name: string; issuer: string }[];
}

export interface ProfileLike {
  name: string;
  service_districts: readonly string[];
  services: readonly string[];
  declared_credentials: readonly { name: string; issuer: string }[];
}

export type ProfileUpdate = Partial<{
  name: string;
  service_districts: District[];
  services: Service[];
  declared_credentials: { name: string; issuer: string }[];
}>;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * Only what really changed. The backend returns a profile to draft whenever a sent field differs
 * from what it holds (including a list in a different order), so unchanged fields are never sent
 * and a list is compared as a set: choosing the same districts again is not an edit.
 */
export function profileChanges(server: ProfileLike, values: ProfileValues): ProfileUpdate {
  const changes: ProfileUpdate = {};
  if (values.name.trim() !== server.name) changes.name = values.name.trim();
  if (!sameSet(server.service_districts, values.service_districts)) changes.service_districts = [...values.service_districts];
  if (!sameSet(server.services, values.services)) changes.services = [...values.services];
  const credentials = values.declared_credentials.map((entry) => ({ name: entry.name.trim(), issuer: entry.issuer.trim() }));
  const same =
    credentials.length === server.declared_credentials.length &&
    credentials.every((entry, index) => {
      const existing = server.declared_credentials[index];
      return existing !== undefined && existing.name === entry.name && existing.issuer === entry.issuer;
    });
  if (!same) changes.declared_credentials = credentials;
  return changes;
}

export const hasChanges = (changes: ProfileUpdate) => Object.keys(changes).length > 0;

export function valuesFromProfile(profile: ProfileLike): ProfileValues {
  return {
    name: profile.name,
    // Canonical order, so the checkbox list reads the same whatever order the server stored.
    service_districts: DISTRICTS.filter((district) => profile.service_districts.includes(district)),
    services: SERVICES.filter((service) => profile.services.includes(service)),
    declared_credentials: profile.declared_credentials.map((entry) => ({ name: entry.name, issuer: entry.issuer })),
  };
}

export const MAX_CREDENTIALS = 20;
const text = messages.company.profile.validation;
const word = z.string().trim().min(1, text.required).max(255);

export const profileSchema = z.object({
  name: z.string().trim().min(1, text.nameRequired).max(255),
  service_districts: z.array(z.enum(DISTRICTS)).max(DISTRICTS.length),
  services: z.array(z.enum(SERVICES)).max(SERVICES.length),
  declared_credentials: z.array(z.object({ name: word, issuer: word })).max(MAX_CREDENTIALS),
});

export interface Completeness {
  districts: number;
  services: number;
  installation: boolean;
  credentials: number;
  /** Whether the profile can receive quotation requests: a district and the installation service. */
  canReceiveRequests: boolean;
}

export function completeness(profile: ProfileLike): Completeness {
  const installation = profile.services.includes("installation");
  return {
    districts: profile.service_districts.length,
    services: profile.services.length,
    installation,
    credentials: profile.declared_credentials.length,
    canReceiveRequests: installation && profile.service_districts.length > 0,
  };
}

/** What saving would do to the directory listing, so the screen can warn before it happens. */
export function savingEffect(status: PublicationStatus): "none" | "withdraws" | "unlists" | "reopens" {
  if (status === "pending") return "withdraws";
  if (status === "approved") return "unlists";
  if (status === "rejected") return "reopens";
  return "none";
}

export const canSubmit = (status: PublicationStatus) => status === "draft" || status === "rejected";
