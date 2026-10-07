/** Where a delivery's quotation stands across all its revisions, and which actions that allows. */
import { formatAmount } from "../format/figures.ts";
import { format, messages } from "../../messages/index.ts";

const text = messages.company.quotation.lifecycle;
const statusNames: Record<string, string> = messages.company.quotation.section.statuses;

export interface RevisionLike {
  id: string;
  revision_number: number;
  status: string;
  sent_at: string | null;
  valid_until: string | null;
  total: string | null;
}

export type Workspace =
  /** A draft is open for editing, and a sent revision may still be what the customer sees. */
  | { kind: "draft"; draft: RevisionLike; sent: RevisionLike | null }
  /** A sent revision is live and frozen: it can only be revised or withdrawn. */
  | { kind: "sent"; revision: RevisionLike }
  | { kind: "expired"; revision: RevisionLike }
  | { kind: "accepted"; revision: RevisionLike }
  | { kind: "declined"; revision: RevisionLike }
  /** The latest revision was withdrawn after it had been sent, which cannot be undone. */
  | { kind: "withdrawn-sent"; revision: RevisionLike }
  /** The latest draft was discarded before anything was sent, so a new draft may be started. */
  | { kind: "withdrawn-draft"; revision: RevisionLike }
  | { kind: "none" };

const byNumber = (revisions: readonly RevisionLike[]) => [...revisions].sort((a, b) => b.revision_number - a.revision_number);

/** A sent revision past its valid-until time is expired even if its stored status still says sent. */
export function effectiveStatus(revision: RevisionLike, now: number): string {
  if (revision.status === "sent" && revision.valid_until !== null && Date.parse(revision.valid_until) <= now) return "expired";
  return revision.status;
}

export function workspaceState(revisions: readonly RevisionLike[], now: number): Workspace {
  const sorted = byNumber(revisions);
  const latest = sorted[0];
  if (!latest) return { kind: "none" };
  const draft = sorted.find((revision) => revision.status === "draft");
  const live = sorted.find((revision) => revision.status === "sent");
  if (draft) return { kind: "draft", draft, sent: live ?? null };
  const accepted = sorted.find((revision) => revision.status === "accepted");
  if (accepted) return { kind: "accepted", revision: accepted };
  if (live) return { kind: effectiveStatus(live, now) === "expired" ? "expired" : "sent", revision: live };
  const declined = sorted.find((revision) => revision.status === "declined");
  if (declined) return { kind: "declined", revision: declined };
  if (latest.status === "expired") return { kind: "expired", revision: latest };
  if (latest.status === "withdrawn") return { kind: latest.sent_at ? "withdrawn-sent" : "withdrawn-draft", revision: latest };
  return { kind: "none" };
}

export interface LifecycleActions {
  canSend: boolean;
  canDiscardDraft: boolean;
  canRevise: boolean;
  canWithdraw: boolean;
  canStartNew: boolean;
}

/** Which actions the state allows; `active` is whether the enquiry itself is still active. */
export function actionsFor(state: Workspace, active: boolean): LifecycleActions {
  const none = { canSend: false, canDiscardDraft: false, canRevise: false, canWithdraw: false, canStartNew: false };
  if (!active) return none;
  if (state.kind === "draft") return { ...none, canSend: true, canDiscardDraft: true };
  if (state.kind === "sent") return { ...none, canRevise: true, canWithdraw: true };
  if (state.kind === "withdrawn-draft") return { ...none, canStartNew: true };
  return none;
}

/** A one-line, plain explanation of the state for the page header. */
export function explain(state: Workspace): string {
  switch (state.kind) {
    case "draft":
      return state.sent
        ? format(text.explain.draftOverSent, { sent: state.sent.revision_number, draft: state.draft.revision_number })
        : text.explain.draft;
    case "sent":
      return format(text.explain.sent, { number: state.revision.revision_number });
    case "expired":
      return format(text.explain.expired, { number: state.revision.revision_number });
    case "accepted":
      return format(text.explain.accepted, { number: state.revision.revision_number });
    case "declined":
      return format(text.explain.declined, { number: state.revision.revision_number });
    case "withdrawn-sent":
      return format(text.explain.withdrawnSent, { number: state.revision.revision_number });
    case "withdrawn-draft":
      return text.explain.withdrawnDraft;
    default:
      return text.explain.none;
  }
}

/** What to tell staff after a refused action, from the fresh state rather than the error text. */
export function staleMessage(fresh: Workspace): string {
  const t = text.stale;
  switch (fresh.kind) {
    case "sent":
      return t.sent;
    case "expired":
      return t.expired;
    case "accepted":
    case "declined":
      return t.decided;
    case "withdrawn-sent":
    case "withdrawn-draft":
      return t.withdrawn;
    case "draft":
      return t.draft;
    default:
      return t.other;
  }
}

/** How the total moved between two revisions, or null when it did not or one is missing. */
export function totalChange(previous: string | null, next: string | null): string | null {
  if (previous === null || next === null) return null;
  const a = Number(previous);
  const b = Number(next);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  const money = (value: string) => formatAmount(value, "") ?? "";
  return format(text.history.totalChanged, { from: money(previous), to: money(next) });
}

export function statusLabel(revision: RevisionLike, now: number): string {
  const status = effectiveStatus(revision, now);
  return statusNames[status] ?? status;
}
