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
import { useCompanyInstallations } from "@/lib/installations/hooks";
import { progressText } from "@/lib/installations/progress";
import { format, messages } from "@/messages";

const text = messages.company.installations;

/** The company's accepted installations; the company comes from the person's own memberships. */
export function CompanyInstallationsView() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <StaffGate basePath="/company/installations">{(company) => <List companyId={company.company_id} name={company.company_name} />}</StaffGate>
    </div>
  );
}

function List({ companyId, name }: { companyId: string; name: string }) {
  const router = useRouter();
  const page = parsePageParam(useSearchParams().get("page") ?? undefined);
  const query = useCompanyInstallations(companyId, page);
  const hrefFor = (target: number) => `/company/installations?company=${companyId}${target > 1 ? `&page=${target}` : ""}`;

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
      <QueryState query={query} isEmpty={(result) => result.total === 0} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} />}>
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-2">
                {result.items.map((item) => (
                  <li key={item.id}>
                    <Card className="relative h-full">
                      <CardHeader>
                        <CardTitle>
                          <h2 className="text-base">
                            <Link
                              href={`/company/installations/${item.id}?company=${companyId}`}
                              className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                            >
                              {format(text.started, { date: formatLongDate(item.created_at) ?? item.created_at })}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription>{progressText(item.completed_milestones, item.total_milestones)}</CardDescription>
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
