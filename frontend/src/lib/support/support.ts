/** Rules for support cases and troubleshooting screens, mirroring what the backend allows. */
import { messages } from "../../messages/index.ts";

const text = messages.support;

export type CaseStatus = "open" | "in_progress" | "resolved" | "closed";

export function statusLabel(status: string): string {
  return (text.statuses as Record<string, string>)[status] ?? status;
}

/** Cases reported as dangerous first, each group keeping the order it came in; nothing is dropped or changed. */
export function dangerFirst<T extends { unsafe_now: boolean }>(cases: readonly T[]): T[] {
  return [...cases.filter((item) => item.unsafe_now), ...cases.filter((item) => !item.unsafe_now)];
}

/** The colour family of a case's status chip; the words always say the same thing. */
export function caseTone(status: string): "info" | "warning" | "success" | "neutral" {
  if (status === "open") return "info";
  if (status === "in_progress") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

export function roleLabel(role: string | null): string {
  const names: Record<string, string> = text.roles;
  return role === null ? (names.unknown ?? "") : (names[role] ?? role);
}

export interface Move {
  to: CaseStatus;
  /** Closing without a resolution must say why. */
  needsReason: boolean;
}

/** What the customer may do to a case in this status. */
export function customerMoves(status: string): Move[] {
  if (status === "closed") return [];
  const moves: Move[] = [{ to: "closed", needsReason: false }];
  if (status === "resolved") moves.unshift({ to: "open", needsReason: false });
  return moves;
}

/** What the company may do to a case in this status. */
export function staffMoves(status: string): Move[] {
  switch (status) {
    case "open":
      return [{ to: "in_progress", needsReason: false }, { to: "closed", needsReason: true }];
    case "in_progress":
      return [{ to: "resolved", needsReason: false }, { to: "closed", needsReason: true }];
    case "resolved":
      return [{ to: "in_progress", needsReason: false }, { to: "closed", needsReason: false }];
    default:
      return [];
  }
}

export const canWrite = (status: string) => status !== "closed";

/** A fresh key for one submission, so a retry of the same click is recognised by the server. */
export function newKey(): string {
  return globalThis.crypto.randomUUID();
}

export interface RefLike {
  safety_level: string;
  title: string;
}

/** Hazards come first, then routine observations, each group alphabetical; the server already orders them. */
export function ordered<T extends RefLike>(references: readonly T[]): T[] {
  return [...references].sort((a, b) => Number(b.safety_level === "hazard") - Number(a.safety_level === "hazard") || a.title.localeCompare(b.title));
}

/** The query for the lookup: an exact model name, or a product the person chose from a list. */
export function lookupQuery(input: { model: string; code: string; productId?: string }): Record<string, string> | null {
  const code = input.code.trim();
  if (input.productId) return code ? { product_id: input.productId, code } : { product_id: input.productId };
  const model = input.model.trim();
  if (!model) return null;
  return code ? { model, code } : { model };
}

export function stepsFromText(raw: string): string[] {
  return raw.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Where a notification about a support case should lead this person. */
export function supportDestination(roles: readonly string[]): string {
  if (roles.some((role) => role === "company_admin" || role === "sales")) return "/company/support";
  if (roles.includes("technician")) return "/technician/support";
  return "/my/support";
}
