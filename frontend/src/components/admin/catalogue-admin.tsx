"use client";

import { Archive, Sun, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { Pagination } from "@/components/catalogue/pagination";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PRODUCTS_PAGE_SIZE, useAdminProducts } from "@/lib/admin/hooks";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.adminCatalogue;
type Kind = "panel" | "inverter";

const hrefFor = (kind: Kind, search: string, page: number) => {
  const params = new URLSearchParams();
  if (kind === "inverter") params.set("kind", "inverter");
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/catalogue?${query}` : "/admin/catalogue";
};

/** The catalogue as the platform edits it: pick a product to change its specifications. */
export function CatalogueAdmin() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <PlatformGate>{() => <List />}</PlatformGate>
    </div>
  );
}

function List() {
  const router = useRouter();
  const params = useSearchParams();
  const kind: Kind = params.get("kind") === "inverter" ? "inverter" : "panel";
  const search = (params.get("search") ?? "").slice(0, 100);
  const page = parsePageParam(params.get("page") ?? undefined);
  const query = useAdminProducts(kind, search, page);
  const [draft, setDraft] = useState(search);

  return (
    <>
      <nav aria-label={text.kindLabel}>
        <ul className="flex flex-wrap gap-2">
          {(["panel", "inverter"] as const).map((option) => (
            <li key={option}>
              <Link
                href={hrefFor(option, "", 1)}
                aria-current={kind === option ? "page" : undefined}
                className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium", kind === option ? "border-orange bg-orange text-on-orange" : "border-line bg-paper-2 text-ink hover:bg-orange-tint")}
              >
                {option === "panel" ? <Sun aria-hidden className="size-4" /> : <Zap aria-hidden className="size-4" />}
                {option === "panel" ? text.panels : text.inverters}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form
        className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-e1"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(hrefFor(kind, draft.trim(), 1));
        }}
      >
        <label htmlFor="product-search" className="type-subheading block text-ink">
          {text.search}
        </label>
        <div className="flex flex-wrap gap-3">
          <input id="product-search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={100} className="field-control h-11 min-w-0 flex-1 basis-60 px-3.5" />
          <Button type="submit">{text.searchApply}</Button>
        </div>
        <p className="type-small flex items-center gap-2 text-ink-2" data-archived-note>
          <Archive aria-hidden className="size-4 shrink-0" />
          {text.archivedNote}
        </p>
      </form>
      <QueryState query={query} isEmpty={(result) => result.total === 0} empty={<EmptyState title={text.empty} />}>
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="type-small text-ink-2">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-products>
                {result.items.slice(0, PRODUCTS_PAGE_SIZE).map((item) => (
                  <li key={item.id}>
                    <article className="relative flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none" data-product={item.id}>
                      <p className="type-figure text-2xl font-semibold text-ink" data-figure>
                        {item.kind === "panel" ? (item.wattage_w ? format(text.watts, { value: item.wattage_w }) : text.unknown) : item.capacity_kw ? format(text.kilowatts, { value: item.capacity_kw }) : text.unknown}
                      </p>
                      <h2 className="type-subheading text-ink">
                        <Link href={`/admin/catalogue/${item.id}`} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
                          {format(text.edit, { name: format(text.fullName, { brand: item.brand, model: item.model }) })}
                        </Link>
                      </h2>
                    </article>
                  </li>
                ))}
              </ul>
              <Pagination hrefFor={(target) => hrefFor(kind, search, target)} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </>
  );
}
