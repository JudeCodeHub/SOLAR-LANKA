"use client";

import { CalendarClock, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { groupVisits, type VisitGroup } from "@/lib/visits/schedule";
import { useMyAssignedVisits } from "@/lib/visits/hooks";
import { formatRange, statusLabel, visitTone } from "@/lib/visits/slots";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.visits.technician;
const GROUPS: VisitGroup[] = ["today", "upcoming", "earlier"];

/** One booked visit as a large tile: the time, the district and the status, the whole tile at least 72 px tall and pressable. */
export function VisitTile({ visit, today = false }: { visit: { id: string; status: string; district: string | null; confirmed_starts_at: string | null; confirmed_ends_at: string | null }; today?: boolean }) {
  const range = visit.confirmed_starts_at && visit.confirmed_ends_at ? formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, "Asia/Colombo") : "";
  return (
    <article className={cn("relative flex min-h-[4.5rem] items-center gap-4 rounded-card border p-4 text-sm transition-shadow hover:shadow-e2 motion-reduce:transition-none", today ? "border-orange-text/40 bg-orange-tint shadow-[inset_4px_0_0_var(--ds-orange-text),var(--ds-shadow-1)]" : "border-line bg-surface shadow-e1")} data-visit-tile={visit.status} data-today={today}>
      <CalendarClock aria-hidden className="size-6 shrink-0 text-orange-text" />
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="type-subheading text-ink">
          <Link href={`/technician/visits/${visit.id}`} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
            {format(text.open, { day: range })}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-ink-2">
          <MapPin aria-hidden className="size-4 shrink-0" />
          {format(text.district, { district: visit.district ?? "" })}
        </p>
        <Badge variant={visitTone(visit.status)} data-visit-status>
          {statusLabel(visit.status)}
        </Badge>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
    </article>
  );
}

/** The technician's booked visits, today's first, with the district and the time only. */
export function TechnicianVisits() {
  const query = useMyAssignedVisits();
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState art="calendar" title={text.none} description={text.notTechnician} />}>
        {(items) => {
          const groups = groupVisits(items, query.dataUpdatedAt);
          return (
            <div className="space-y-8" data-visits-list>
              {GROUPS.filter((group) => groups[group].length > 0).map((group) => (
                <section key={group} aria-labelledby={`visits-${group}`} className="space-y-3" data-visit-group={group}>
                  <h2 id={`visits-${group}`} className="type-heading text-ink">
                    {text.groups[group]}
                  </h2>
                  <ul className="space-y-3">
                    {groups[group].map((visit) => (
                      <li key={visit.id}>
                        <VisitTile visit={visit} today={group === "today"} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
