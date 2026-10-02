"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PlatformGate } from "@/components/admin/platform-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate } from "@/lib/catalogue/detail";
import { parsePageParam } from "@/lib/catalogue/params";
import { usePendingCompanies } from "@/lib/admin/hooks";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/review";
import { format, messages } from "@/messages";

const text = messages.admin.queue;
const hrefFor = (page: number) => (page > 1 ? `/admin/companies?page=${page}` : "/admin/companies");

/** Companies waiting for review, for platform administrators. */
export function ReviewQueue() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <PlatformGate>{() => <Queue />}</PlatformGate>
    </div>
  );
}

function Queue() {
  const page = parsePageParam(useSearchParams().get("page") ?? undefined);
  const query = usePendingCompanies(page);
  return (
    <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} />}>
      {(items) => {
        const shown = items.slice(0, QUEUE_PAGE_SIZE);
        const more = items.length > QUEUE_PAGE_SIZE;
        return (
          <section aria-label={text.title} className="space-y-4">
            <p className="text-sm text-muted-foreground">{format(text.page, { page })}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {shown.map((company) => (
                <li key={company.id}>
                  <Card className="relative h-full">
                    <CardHeader>
                      <CardTitle>
                        <h2 className="text-base">
                          <Link href={`/admin/companies/${company.id}`} className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                            {format(text.open, { name: company.name })}
                          </Link>
                        </h2>
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <span className="block">{format(text.districts, { count: company.service_districts.length })}</span>
                        <span className="block">{format(text.services, { count: company.services.length })}</span>
                        <span className="block">{format(text.submitted, { date: formatLongDate(company.created_at) ?? company.created_at })}</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
            <nav className="flex gap-4 text-sm" aria-label={text.title}>
              {page > 1 ? (
                <Link href={hrefFor(page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-2">
                  {text.previous}
                </Link>
              ) : null}
              {more ? (
                <Link href={hrefFor(page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-2">
                  {text.next}
                </Link>
              ) : null}
            </nav>
          </section>
        );
      }}
    </QueryState>
  );
}
