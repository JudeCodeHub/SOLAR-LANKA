/** What the customer is shown of an installation's history: only the shared fields the backend returns, grouped by step. */
export interface UpdateLike {
  id: string;
  milestone_id: string;
  created_at: string;
  from_status: string;
  to_status: string;
  reason: string | null;
  next_action: string | null;
  delay_until: string | null;
}

/** The updates for one step, newest first. */
export function updatesFor(history: readonly UpdateLike[], milestoneId: string): UpdateLike[] {
  return history
    .filter((entry) => entry.milestone_id === milestoneId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || (a.id < b.id ? 1 : -1));
}

export interface Schedule {
  nextAction: string | null;
  delayUntil: string | null;
  /** True while the delay date is still ahead; false once it has passed. */
  delayed: boolean;
}

/** The step's latest schedule update (its newest entry that sets a delay or a next action), or null when it never had one. */
export function scheduleFor(updates: readonly UpdateLike[], now: number): Schedule | null {
  const latest = updates.find((entry) => entry.delay_until !== null || (entry.next_action ?? "").trim() !== "");
  if (!latest) return null;
  return {
    nextAction: (latest.next_action ?? "").trim() || null,
    delayUntil: latest.delay_until,
    delayed: latest.delay_until !== null && Date.parse(latest.delay_until) > now,
  };
}

/** A status change is a real move; an entry with the same status before and after only shares a schedule note. */
export function isStatusChange(entry: UpdateLike): boolean {
  return entry.from_status !== entry.to_status;
}
