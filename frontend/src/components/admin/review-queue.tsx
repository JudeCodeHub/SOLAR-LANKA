"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PlatformGate } from "@/components/admin/platform-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Hourglass } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
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
            <p className="type-small text-ink-2">{format(text.page, { page })}</p>
            <ul className="grid gap-4 sm:grid-cols-2" data-queue>
              {shown.map((company) => (
                <li key={company.id}>
                  <article className="relative flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none" data-company={company.id}>
                    <Badge variant="info" icon={Hourglass}>
                      {text.waiting}
                    </Badge>
                    <h2 className="type-subheading text-ink">
                      <Link href={`/admin/companies/${company.id}`} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
                        {format(text.open, { name: company.name })}
                      </Link>
                    </h2>
                    <p className="text-ink-2">{format(text.districts, { count: company.service_districts.length })}</p>
                    <p className="text-ink-2">{format(text.services, { count: company.services.length })}</p>
                    <p className="text-ink-2">{format(text.submitted, { date: formatLongDate(company.created_at) ?? company.created_at })}</p>
                  </article>
                </li>
              ))}
            </ul>
            <nav className="flex gap-3 text-sm" aria-label={text.title}>
              {page > 1 ? (
                <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline" })}>
                  {text.previous}
                </Link>
              ) : null}
              {more ? (
                <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline" })}>
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
