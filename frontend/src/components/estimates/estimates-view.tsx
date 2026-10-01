"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={
          <EmptyState
            title={text.emptyTitle}
            description={text.emptyDescription}
            action={
              <Button asChild variant="outline" size="sm">
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
              <p className="text-sm text-muted-foreground">
                {format(text.showing, { from: info.from, to: info.to, total: result.total })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {result.items.map((item) => (
                  <li key={item.id}>
                    <Card className="relative h-full">
                      <CardHeader>
                        <CardTitle>
                          <h2 className="text-base">
                            <Link
                              href={`/my/estimates/${item.id}`}
                              className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                            >
                              {format(plural(text.item.size, item.panel_count_maximum), {
                                capacity: rangeText(item.capacity_kwp_minimum, item.capacity_kwp_maximum),
                                panels: rangeText(item.panel_count_minimum, item.panel_count_maximum),
                              })}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription>
                          {format(text.item.saved, { date: formatLongDate(item.created_at) ?? item.created_at })}
                          <span className="block">{format(text.item.version, { version: item.config_version })}</span>
                        </CardDescription>
                      </CardHeader>
                    </Card>
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
