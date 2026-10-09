"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PlatformGate } from "@/components/admin/platform-gate";
import { NAV_ICONS } from "@/components/shell/nav-icons";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { usePendingCompanies } from "@/lib/admin/hooks";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/review";
import { format, messages } from "@/messages";

const text = messages.shell.admin;

const AREAS = [
  { id: "admin-catalogue", href: "/admin/catalogue", title: text.catalogue, help: text.catalogueHelp },
  { id: "admin-education", href: "/admin/education", title: text.education, help: text.educationHelp },
  { id: "admin-estimator", href: "/admin/estimator", title: text.estimator, help: text.estimatorHelp },
  { id: "admin-users", href: "/admin/users", title: text.users, help: text.usersHelp },
  { id: "admin-activity", href: "/admin/activity", title: text.activity, help: text.activityHelp },
] as const;

const CARD = "group flex items-start gap-4 rounded-card border border-line bg-surface p-5 shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none";

/** The administrator's home: how many companies wait for review, and a card for each administration area. */
export function AdminHome() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6">
      <PageHeader title={text.title} description={text.lead} />
      <PlatformGate>{() => <Cards />}</PlatformGate>
    </div>
  );
}

function Cards() {
  const pending = usePendingCompanies(1);
  const waiting = pending.data ? Math.min(pending.data.length, QUEUE_PAGE_SIZE) : null;
  const more = (pending.data?.length ?? 0) > QUEUE_PAGE_SIZE;
  const Icon = NAV_ICONS["admin-companies"];
  return (
    <ul className="grid gap-4 sm:grid-cols-2" data-admin-home>
      <li className="sm:col-span-2">
        <Link href="/admin/companies" className={CARD} data-card="companies">
          {Icon ? <Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-orange-text" /> : null}
          <span className="flex-1 space-y-1">
            <span className="type-subheading block text-ink">{text.companies}</span>
            <span className="type-small block text-ink-2">{waiting === 0 ? text.companiesNone : waiting === null ? "" : format(text.companiesWaiting, { count: more ? `${QUEUE_PAGE_SIZE}+` : waiting })}</span>
          </span>
          {waiting !== null && waiting > 0 ? <Badge variant="orange">{more ? `${QUEUE_PAGE_SIZE}+` : waiting}</Badge> : null}
          <ArrowRight aria-hidden className="mt-1 size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </li>
      {AREAS.map((area) => {
        const AreaIcon = NAV_ICONS[area.id];
        return (
          <li key={area.id}>
            <Link href={area.href} className={CARD} data-card={area.id}>
              {AreaIcon ? <AreaIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-orange-text" /> : null}
              <span className="flex-1 space-y-1">
                <span className="type-subheading block text-ink">{area.title}</span>
                <span className="type-small block text-ink-2">{area.help}</span>
              </span>
              <ArrowRight aria-hidden className="mt-1 size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
