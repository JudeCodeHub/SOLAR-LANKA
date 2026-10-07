"use client";

import { Building2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { EnquiryCard } from "@/components/company/enquiry-card";
import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { useInbox } from "@/lib/inbox/hooks";
import { format, messages } from "@/messages";

const text = messages.company.inbox;

/** The company's enquiries; the company comes from the person's own memberships. */
export function InboxView() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
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
      <p className="inline-flex min-h-8 w-fit items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink" data-company-name>
        <Building2 aria-hidden className="size-4 text-orange-text" />
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
              <p className="type-small text-ink-2">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-inbox>
                {result.items.map((item) => (
                  <li key={item.id}>
                    <EnquiryCard item={item} href={`/company/inbox/${item.id}?company=${companyId}`} />
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
