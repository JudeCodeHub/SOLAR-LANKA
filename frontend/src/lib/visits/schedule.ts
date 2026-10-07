/** How a technician's visits are grouped on their page: today's first, then what is coming, then what has passed. */
const ZONE = "Asia/Colombo";

export interface AssignedVisitLike {
  id: string;
  status: string;
  confirmed_starts_at: string | null;
  confirmed_ends_at: string | null;
}

export type VisitGroup = "today" | "upcoming" | "earlier";

/** The calendar day of a moment in Sri Lanka time, as year-month-day. */
export function dayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Which group a visit belongs to at a given moment; a visit with no confirmed time is upcoming, because it is still to be fixed. */
export function groupOf(visit: AssignedVisitLike, now: number): VisitGroup {
  if (!visit.confirmed_starts_at) return "upcoming";
  const today = dayOf(new Date(now).toISOString());
  const day = dayOf(visit.confirmed_starts_at);
  if (day === today) return "today";
  return day > today ? "upcoming" : "earlier";
}

/** The visits in their groups: today's and coming ones soonest first, earlier ones newest first; nothing is dropped. */
export function groupVisits<T extends AssignedVisitLike>(visits: readonly T[], now: number): Record<VisitGroup, T[]> {
  const groups: Record<VisitGroup, T[]> = { today: [], upcoming: [], earlier: [] };
  for (const visit of visits) groups[groupOf(visit, now)].push(visit);
  const time = (visit: T) => (visit.confirmed_starts_at ? Date.parse(visit.confirmed_starts_at) : Number.MAX_SAFE_INTEGER);
  groups.today.sort((a, b) => time(a) - time(b));
  groups.upcoming.sort((a, b) => time(a) - time(b));
  groups.earlier.sort((a, b) => time(b) - time(a));
  return groups;
}
