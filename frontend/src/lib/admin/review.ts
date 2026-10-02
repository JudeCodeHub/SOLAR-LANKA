/** Rules for the platform administrator's company review and account status screens, mirroring the backend. */
import { format, messages } from "../../messages/index.ts";

const text = messages.admin;

export const QUEUE_PAGE_SIZE = 10;

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function outcomeLabel(outcome: string): string {
  return (text.outcomes as Record<string, string>)[outcome] ?? outcome;
}

export function statusLabel(status: string): string {
  return (text.statuses as Record<string, string>)[status] ?? status;
}

/** Only a pending submission can be decided; the backend refuses anything else. */
export function canDecide(status: string | undefined): boolean {
  return status === "pending";
}

/** Why a refused decision failed, from the company as it stands now, never from the server's wording. */
export function refusalText(fresh: { name: string; publication_status: string } | undefined): string {
  if (!fresh) return text.refused.gone;
  const status = fresh.publication_status;
  if (status === "approved" || status === "rejected") return format(text.refused.decided, { name: fresh.name, status: statusLabel(status) });
  if (status === "draft") return format(text.refused.returned, { name: fresh.name });
  return text.refused.generic;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AccountAction = "suspend" | "restore";

/** Whether an account change may be attempted, and the reason when not. */
export function accountProblem(input: { targetId: string; selfId: string | undefined; action: AccountAction }): string | null {
  const id = input.targetId.trim();
  if (id === "") return text.users.errors.idRequired;
  if (!UUID.test(id)) return text.users.errors.idFormat;
  if (input.action === "suspend" && id.toLowerCase() === input.selfId?.toLowerCase()) return text.users.errors.self;
  return null;
}

/** Why a refused account change failed; the backend allows exactly one conflict per action. */
export function accountRefusal(action: AccountAction): string {
  return action === "restore" ? text.users.refused.providerRevoked : text.users.refused.self;
}
