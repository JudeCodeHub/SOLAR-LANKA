"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { InstallationCard } from "@/components/installations/installation-card";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { useInstallations } from "@/lib/quotation/customer-hooks";
import { format, messages } from "@/messages";

const text = messages.tracking.list;
const hrefFor = (page: number) => (page > 1 ? `/my/installations?page=${page}` : "/my/installations");

/** The customer's accepted installations, newest first, each with how far along it is. */
export function InstallationsView() {
  const router = useRouter();
  const page = parsePageParam(useSearchParams().get("page") ?? undefined);
  const query = useInstallations(page);

  const data = query.data;
  const lastPage = data ? pageInfo(data.total, page).page : page;
  useEffect(() => {
    if (data && data.total > 0 && data.items.length === 0 && lastPage !== page) router.replace(hrefFor(lastPage));
  }, [data, lastPage, page, router]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
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
                <Link href="/my/requests">{text.viewRequests}</Link>
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
              <ul className="grid gap-4 sm:grid-cols-2" data-installations>
                {result.items.map((item) => (
                  <li key={item.id}>
                    <InstallationCard item={item} />
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
