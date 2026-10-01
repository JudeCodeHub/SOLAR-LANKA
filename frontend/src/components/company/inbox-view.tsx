"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate } from "@/lib/catalogue/detail";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { useInbox } from "@/lib/inbox/hooks";
import { companyStatusLabel } from "@/lib/inbox/inbox";
import { format, messages } from "@/messages";

const text = messages.company.inbox;

/** The company's enquiries; the company comes from the person's own memberships. */
export function InboxView() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <StaffGate basePath="/company/inbox">{(company) => <Inbox companyId={company.company_id} name={company.company_name} />}</StaffGate>
    </div>
  );
}

function Inbox({ companyId, name }: { companyId: string; name: string }) {
  const router = useRouter();
  const page = parsePageParam(useSearchParams().get("page") ?? undefined);
  const query = useInbox(companyId, page);
  const hrefFor = (target: number) => `/company/inbox?company=${companyId}${target > 1 ? `&page=${target}` : ""}`;

  const data = query.data;
  const lastPage = data ? pageInfo(data.total, page).page : page;
  useEffect(() => {
    if (data && data.total > 0 && data.items.length === 0 && lastPage !== page) router.replace(hrefFor(lastPage));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hrefFor only depends on companyId
  }, [data, lastPage, page, router, companyId]);

  return (
    <>
      <p className="text-sm text-muted-foreground" data-company-name>
        {name}
      </p>
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} />}
      >
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {format(text.showing, { from: info.from, to: info.to, total: result.total })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2" data-inbox>
                {result.items.map((item) => (
                  <li key={item.id}>
                    <Card className="relative h-full" data-status={item.status}>
                      <CardHeader>
                        <CardTitle>
                          <h2 className="text-base">
                            <Link
                              href={`/company/inbox/${item.id}?company=${companyId}`}
                              className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                            >
                              {format(text.receivedOn, { date: formatLongDate(item.created_at) ?? item.created_at })}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription className="space-y-1">
                          <span className="block font-medium text-foreground">{companyStatusLabel(item.status)}</span>
                          <span className="block">{format(text.district, { district: item.district })}</span>
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
    </>
  );
}
