"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <PlatformGate>{() => <Body />}</PlatformGate>
    </div>
  );
}

function Body() {
  const activity = useActivity();
  return (
    <>
      <section aria-labelledby="counts-title" className="space-y-2">
        <h2 id="counts-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.countsTitle}
        </h2>
        <QueryState query={activity}>
          {(counts) => (
            <dl className="grid gap-3 sm:grid-cols-2" data-counts>
              {(
                [
                  [text.users, counts.users],
                  [text.approvedCompanies, counts.approved_companies],
                  [text.activeProducts, counts.active_products],
                  [text.auditEvents, counts.audit_events],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-semibold">{value}</dd>
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
    <section aria-labelledby="log-title" className="space-y-3">
      <h2 id="log-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.logTitle}
      </h2>
      <form
        noValidate
        className="space-y-1"
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
        <label htmlFor="company-filter" className="block font-medium">
          {text.filterLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="company-filter"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={`company-filter-help${problem ? " company-filter-error" : ""}`}
            autoComplete="off"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 field-control px-3"
          />
          <Button type="submit" variant="outline" data-action="filter">
            {text.filterApply}
          </Button>
          {company ? (
            <Button asChild variant="outline">
              <Link href={hrefFor("", 1)}>{text.filterClear}</Link>
            </Button>
          ) : null}
        </div>
        <p id="company-filter-help" className="text-sm text-muted-foreground">
          {text.filterHelp}
        </p>
        {problem ? (
          <p id="company-filter-error" role="alert" className="text-sm font-medium text-destructive" data-error="filter">
            {problem}
          </p>
        ) : null}
      </form>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={company ? text.emptyFiltered : text.empty} />}>
        {(items) => {
          const shown = items.slice(0, AUDIT_PAGE_SIZE);
          return (
            <>
              <p className="text-sm text-muted-foreground">{format(text.page, { page })}</p>
              <ul className="space-y-2" data-audit>
                {shown.map((entry) => (
                  <li key={entry.id} className="space-y-1 rounded-lg border p-3 text-sm" data-audit-entry={entry.action}>
                    <p className="font-medium">{actionLabel(entry.action)}</p>
                    <p className="text-muted-foreground">{formatLongDate(entry.created_at) ?? entry.created_at}</p>
                    <p>{format(messages.admin.detail.by, { id: shortId(entry.actor_id) })}</p>
                    <p>{format(text.companyLine, { company: entry.company_id ? shortId(entry.company_id) : text.none })}</p>
                    {entry.action.startsWith("user.") ? (
                      <Link href={`/admin/users?user=${entry.target_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                        {format(text.manage, { id: shortId(entry.target_id) })}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              <nav className="flex gap-4 text-sm" aria-label={text.logTitle}>
                {page > 1 ? (
                  <Link href={hrefFor(company, page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-2">
                    {text.previous}
                  </Link>
                ) : null}
                {items.length > AUDIT_PAGE_SIZE ? (
                  <Link href={hrefFor(company, page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-2">
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
