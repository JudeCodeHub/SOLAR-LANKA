"use client";

import Link from "next/link";

import { PlatformGate } from "@/components/admin/platform-gate";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Archive, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { inUseIds } from "@/lib/admin/config";
import { useConfigVersions } from "@/lib/admin/hooks";
import { formatLongDate } from "@/lib/catalogue/detail";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.adminEstimator;

/** The stored estimator versions, with which one customers get. */
export function EstimatorAdmin() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <PlatformGate>{() => <Versions />}</PlatformGate>
    </div>
  );
}

function Versions() {
  const query = useConfigVersions();
  return (
    <>
      <Button asChild size="lg" className="w-fit">
        <Link href="/admin/estimator/new">{text.newDraft}</Link>
      </Button>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.empty} />}>
        {(items) => {
          const inUse = inUseIds(items);
          return (
            <ul className="space-y-3" data-versions>
              {items.map((item) => (
                <li key={item.id}>
                  <VersionCard item={item} current={inUse.has(item.id)} />
                </li>
              ))}
            </ul>
          );
        }}
      </QueryState>
    </>
  );
}

/** One stored version: which scenario it is for, whether it is a draft or published, archived, and above all whether customers are using it now. */
export function VersionCard({ item, current }: { item: { id: string; version: number; scenario: string; status: string; is_archived: boolean; created_at: string; published_at: string | null }; current: boolean }) {
  return (
    <article className={cn("space-y-2 rounded-card border p-5 text-sm", current ? "border-success bg-success-tint shadow-[inset_4px_0_0_var(--ds-success),var(--ds-shadow-1)]" : "border-line bg-surface shadow-e1")} data-version={item.version} data-status={item.status} data-current={current}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="type-subheading text-ink">
          <Link href={`/admin/estimator/${item.id}`} className="inline-flex min-h-11 items-center rounded-field underline-offset-4 hover:underline">
            {format(text.open, { version: item.version })}
          </Link>
        </h2>
        {current ? (
          <Badge variant="success" icon={Radio} data-badge="current">
            {text.current}
          </Badge>
        ) : null}
      </div>
      <p className="font-medium text-ink" data-scenario>
        {text.scenarios[item.scenario] ?? item.scenario}
      </p>
      <p className="flex flex-wrap gap-2">
        <Badge variant={item.status === "published" ? "info" : "neutral"} data-badge="status">
          {text.status[item.status] ?? item.status}
        </Badge>
        {item.is_archived ? (
          <Badge variant="neutral" icon={Archive} data-badge="archived">
            {text.archived}
          </Badge>
        ) : null}
      </p>
      <p className="text-ink-2">{format(text.created, { date: formatLongDate(item.created_at) ?? item.created_at })}</p>
      {item.published_at ? <p className="text-ink-2">{format(text.publishedOn, { date: formatLongDate(item.published_at) ?? item.published_at })}</p> : null}
    </article>
  );
}
