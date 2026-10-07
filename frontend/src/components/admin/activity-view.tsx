"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableRegion } from "@/components/ui/table";
import { actionLabel, AUDIT_PAGE_SIZE } from "@/lib/admin/audit";
import { useActivity, useAuditEvents } from "@/lib/admin/hooks";
import { shortId } from "@/lib/admin/review";
import { formatLongDate } from "@/lib/catalogue/detail";
import { parsePageParam } from "@/lib/catalogue/params";
import { isProductId } from "@/lib/catalogue/links";
import { format, messages } from "@/messages";

const text = messages.adminActivity;

const hrefFor = (company: string, page: number) => {
  const params = new URLSearchParams();
  if (company) params.set("company", company);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/activity?${query}` : "/admin/activity";
};

/** Platform counts and the read-only audit log, for platform administrators. */
export function ActivityView() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <PlatformGate>{() => <Body />}</PlatformGate>
    </div>
  );
}

function Body() {
  const activity = useActivity();
  return (
    <>
      <section aria-labelledby="counts-title" className="space-y-3">
        <h2 id="counts-title" className="type-heading text-ink">
          {text.countsTitle}
        </h2>
        <QueryState query={activity}>
          {(counts) => (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-counts>
              {(
                [
                  [text.users, counts.users],
                  [text.approvedCompanies, counts.approved_companies],
                  [text.activeProducts, counts.active_products],
                  [text.auditEvents, counts.audit_events],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="space-y-1 rounded-card border border-line bg-surface p-5 shadow-e1">
                  <dt className="type-small font-medium text-ink-2">{label}</dt>
                  <dd className="type-figure text-4xl font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </QueryState>
      </section>
      <AuditLog />
    </>
  );
}

function AuditLog() {
  const router = useRouter();
  const search = useSearchParams();
  const raw = search.get("company") ?? "";
  const company = isProductId(raw) ? raw : "";
  const page = parsePageParam(search.get("page") ?? undefined);
  const query = useAuditEvents(company, page, AUDIT_PAGE_SIZE);
  const [draft, setDraft] = useState(raw);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <section aria-labelledby="log-title" className="space-y-4">
      <h2 id="log-title" className="type-heading text-ink">
        {text.logTitle}
      </h2>
      <form
        noValidate
        className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-e1"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim();
          if (value !== "" && !isProductId(value)) {
            setProblem(text.filterBad);
            return;
          }
          setProblem(null);
          router.push(hrefFor(value, 1));
        }}
      >
        <label htmlFor="company-filter" className="type-subheading block text-ink">
          {text.filterLabel}
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="company-filter"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={`company-filter-help${problem ? " company-filter-error" : ""}`}
            autoComplete="off"
            spellCheck={false}
            className="field-control h-11 min-w-0 flex-1 basis-60 px-3.5 font-mono text-sm"
          />
          <Button type="submit" data-action="filter">
            {text.filterApply}
          </Button>
          {company ? (
            <Button asChild variant="outline">
              <Link href={hrefFor("", 1)}>{text.filterClear}</Link>
            </Button>
          ) : null}
        </div>
        <p id="company-filter-help" className="type-small text-ink-2">
          {text.filterHelp}
        </p>
        {problem ? (
          <p id="company-filter-error" role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error="filter">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {problem}
          </p>
        ) : null}
      </form>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={company ? text.emptyFiltered : text.empty} />}>
        {(items) => {
          const shown = items.slice(0, AUDIT_PAGE_SIZE);
          return (
            <>
              <p className="type-small text-ink-2">{format(text.page, { page })}</p>
              <TableRegion label={text.logTitle}>
                <Table data-audit>
                  <caption className="sr-only">{text.logTitle}</caption>
                  <thead>
                    <tr className="text-left">
                      <th scope="col">{text.when}</th>
                      <th scope="col">{text.action}</th>
                      <th scope="col">{text.actor}</th>
                      <th scope="col">{text.company}</th>
                      <th scope="col">{text.target}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((entry) => (
                      <tr key={entry.id} className="align-top" data-audit-entry={entry.action}>
                        <th scope="row" className="whitespace-nowrap text-left font-normal text-ink-2">
                          {formatLongDate(entry.created_at) ?? entry.created_at}
                        </th>
                        <td className="font-medium text-ink">{actionLabel(entry.action)}</td>
                        <td className="type-figure">{format(messages.admin.detail.by, { id: shortId(entry.actor_id) })}</td>
                        <td className="type-figure">{format(text.companyLine, { company: entry.company_id ? shortId(entry.company_id) : text.none })}</td>
                        <td>
                          {entry.action.startsWith("user.") ? (
                            <Link href={`/admin/users?user=${entry.target_id}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
                              {format(text.manage, { id: shortId(entry.target_id) })}
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableRegion>
              <nav className="flex gap-3 text-sm" aria-label={text.logTitle}>
                {page > 1 ? (
                  <Link href={hrefFor(company, page - 1)} className={buttonVariants({ variant: "outline" })}>
                    {text.previous}
                  </Link>
                ) : null}
                {items.length > AUDIT_PAGE_SIZE ? (
                  <Link href={hrefFor(company, page + 1)} className={buttonVariants({ variant: "outline" })}>
                    {text.next}
                  </Link>
                ) : null}
              </nav>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}
