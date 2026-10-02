"use client";

import Link from "next/link";

import { PlatformGate } from "@/components/admin/platform-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { useConfigVersions } from "@/lib/admin/hooks";
import { formatLongDate } from "@/lib/catalogue/detail";
import { format, messages } from "@/messages";

const text = messages.adminEstimator;

/** The stored estimator versions, with which one customers get. */
export function EstimatorAdmin() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <PlatformGate>{() => <Versions />}</PlatformGate>
    </div>
  );
}

function Versions() {
  const query = useConfigVersions();
  return (
    <>
      <Button asChild>
        <Link href="/admin/estimator/new">{text.newDraft}</Link>
      </Button>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.empty} />}>
        {(items) => {
          const current = items.find((item) => item.status === "published" && !item.is_archived);
          return (
            <ul className="space-y-3" data-versions>
              {items.map((item) => (
                <li key={item.id} className="space-y-1 rounded-lg border p-3 text-sm" data-version={item.version} data-status={item.status}>
                  <h2 className="text-base font-semibold">
                    <Link href={`/admin/estimator/${item.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                      {format(text.open, { version: item.version })}
                    </Link>
                  </h2>
                  <p className="flex flex-wrap gap-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs">{text.status[item.status] ?? item.status}</span>
                    {item.is_archived ? <span className="rounded-full border px-2 py-0.5 text-xs">{text.archived}</span> : null}
                    {item.id === current?.id ? <span className="rounded-full border border-foreground px-2 py-0.5 text-xs font-medium">{text.current}</span> : null}
                  </p>
                  <p className="text-muted-foreground">{format(text.created, { date: formatLongDate(item.created_at) ?? item.created_at })}</p>
                  {item.published_at ? <p className="text-muted-foreground">{format(text.publishedOn, { date: formatLongDate(item.published_at) ?? item.published_at })}</p> : null}
                </li>
              ))}
            </ul>
          );
        }}
      </QueryState>
    </>
  );
}
