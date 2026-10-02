"use client";

import Link from "next/link";

import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyAssignedVisits } from "@/lib/visits/hooks";
import { formatRange, statusLabel } from "@/lib/visits/slots";
import { format, messages } from "@/messages";

const text = messages.visits.technician;

/** The technician's booked visits, with the district and the time only. */
export function TechnicianVisits() {
  const query = useMyAssignedVisits();
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.none} description={text.notTechnician} />}>
        {(items) => (
          <ul className="grid gap-3 sm:grid-cols-2" data-visits-list>
            {items.map((visit) => {
              const range = visit.confirmed_starts_at && visit.confirmed_ends_at ? formatRange(visit.confirmed_starts_at, visit.confirmed_ends_at, "Asia/Colombo") : "";
              return (
                <li key={visit.id}>
                  <Card className="relative h-full">
                    <CardHeader>
                      <CardTitle>
                        <h2 className="text-base">
                          <Link href={`/technician/visits/${visit.id}`} className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                            {format(text.open, { day: range })}
                          </Link>
                        </h2>
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <span className="block font-medium text-foreground">{statusLabel(visit.status)}</span>
                        <span className="block">{format(text.district, { district: visit.district ?? "" })}</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
