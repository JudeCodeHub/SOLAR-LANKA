"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PlatformGate } from "@/components/admin/platform-gate";
import { NAV_ICONS } from "@/components/shell/nav-icons";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { usePendingCompanies } from "@/lib/admin/hooks";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/review";
import { formatLongDate } from "@/lib/catalogue/detail";
import { format, messages } from "@/messages";

const text = messages.shell.admin;

const AREAS = [
  { id: "admin-catalogue", href: "/admin/catalogue", title: text.catalogue, help: text.catalogueHelp },
  { id: "admin-education", href: "/admin/education", title: text.education, help: text.educationHelp },
  { id: "admin-estimator", href: "/admin/estimator", title: text.estimator, help: text.estimatorHelp },
  { id: "admin-users", href: "/admin/users", title: text.users, help: text.usersHelp },
  { id: "admin-activity", href: "/admin/activity", title: text.activity, help: text.activityHelp },
] as const;

/** The administrator's home: the review queue first, with each waiting company one click from its review, then every administration area as a compact list. */
export function AdminHome() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={text.title} description={text.lead} />
      <PlatformGate>{() => <Panels />}</PlatformGate>
    </div>
  );
}

function Panels() {
  const pending = usePendingCompanies(1);
  const rows = (pending.data ?? []).slice(0, QUEUE_PAGE_SIZE);
  const more = (pending.data?.length ?? 0) > QUEUE_PAGE_SIZE;
  const count = more ? `${QUEUE_PAGE_SIZE}+` : String(rows.length);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" data-admin-home>
      <section aria-labelledby="queue-title" className="space-y-3 rounded-card border-2 border-orange bg-surface p-5 shadow-e1" data-card="companies">
        <div className="flex items-center justify-between gap-3">
          <h2 id="queue-title" className="type-heading text-ink">
            {text.queueTitle}
          </h2>
          {pending.data && rows.length > 0 ? <Badge variant="orange">{count}</Badge> : null}
        </div>
        {!pending.data ? null : rows.length === 0 ? (
          <p className="type-body text-ink-2">{text.queueEmpty}</p>
        ) : (
          <ul className="divide-y divide-line" data-queue>
            {rows.map((company) => (
              <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{company.name}</p>
                  <p className="text-sm text-ink-2">{format(text.queueSince, { date: formatLongDate(company.created_at) ?? company.created_at })}</p>
                </div>
                <Link href={`/admin/companies/${company.id}`} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-orange-text underline-offset-4 hover:underline">
                  {text.queueReview}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/companies" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline">
          {text.queueAll}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>
      <section aria-labelledby="areas-title" className="space-y-3">
        <h2 id="areas-title" className="type-heading text-ink">
          {text.areasTitle}
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-e1">
          {AREAS.map((area) => {
            const AreaIcon = NAV_ICONS[area.id];
            return (
              <li key={area.id}>
                <Link href={area.href} className="group flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-orange-tint" data-card={area.id}>
                  {AreaIcon ? <AreaIcon aria-hidden className="size-5 shrink-0 text-orange-text" /> : null}
                  <span className="flex-1">
                    <span className="block font-medium text-ink">{area.title}</span>
                    <span className="block text-sm text-ink-2">{area.help}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
