"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatLongDate } from "@/lib/catalogue/detail";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { rangeText } from "@/lib/estimator/format";
import { useSavedEstimates } from "@/lib/estimates/hooks";
import { format, messages, plural } from "@/messages";

const text = messages.estimator.saved;
const hrefFor = (page: number) => (page > 1 ? `/my/estimates?page=${page}` : "/my/estimates");

/** The customer's saved estimates, newest first, from the API with the page in the address. */
export function EstimatesView() {
  const router = useRouter();
  const page = parsePageParam(useSearchParams().get("page") ?? undefined);
  const query = useSavedEstimates(page);

  const data = query.data;
  const lastPage = data ? pageInfo(data.total, page).page : page;
  useEffect(() => {
    if (data && data.total > 0 && data.items.length === 0 && lastPage !== page) {
      router.replace(hrefFor(lastPage));
    }
  }, [data, lastPage, page, router]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={
          <EmptyState
            title={text.emptyTitle}
            description={text.emptyDescription}
            action={
              <Button asChild>
                <Link href="/estimator">{text.startEstimate}</Link>
              </Button>
            }
          />
        }
      >
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="type-small text-ink-2">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="grid gap-4 sm:grid-cols-2">
                {result.items.map((item) => (
                  <li key={item.id}>
                    <article data-estimate-card className="relative flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none">
                      <p aria-hidden className="type-figure text-3xl font-semibold text-ink">
                        {rangeText(item.capacity_kwp_minimum, item.capacity_kwp_maximum)}
                        <span className="ml-1.5 text-base font-medium text-ink-2">{text.item.unit}</span>
                      </p>
                      <h2 className="type-subheading">
                        <Link
                          href={`/my/estimates/${item.id}`}
                          className="flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text"
                        >
                          {format(plural(text.item.size, item.panel_count_maximum), {
                            capacity: rangeText(item.capacity_kwp_minimum, item.capacity_kwp_maximum),
                            panels: rangeText(item.panel_count_minimum, item.panel_count_maximum),
                          })}
                        </Link>
                      </h2>
                      <p className="type-small mt-auto text-ink-2">
                        {format(text.item.saved, { date: formatLongDate(item.created_at) ?? item.created_at })}
                        <span className="block">{format(text.item.version, { version: item.config_version })}</span>
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
              <Pagination hrefFor={hrefFor} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
