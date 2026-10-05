"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { Pagination } from "@/components/catalogue/pagination";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCTS_PAGE_SIZE, useAdminProducts } from "@/lib/admin/hooks";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
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
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
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
      <nav aria-label={text.kindLabel} className="flex gap-2">
        {(["panel", "inverter"] as const).map((option) => (
          <Button key={option} asChild variant={kind === option ? "default" : "outline"} size="sm">
            <Link href={hrefFor(option, "", 1)} aria-current={kind === option ? "page" : undefined}>
              {option === "panel" ? text.panels : text.inverters}
            </Link>
          </Button>
        ))}
      </nav>
      <form
        className="space-y-1"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(hrefFor(kind, draft.trim(), 1));
        }}
      >
        <label htmlFor="product-search" className="block font-medium">
          {text.search}
        </label>
        <div className="flex gap-2">
          <input id="product-search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={100} className="h-11 min-w-0 flex-1 field-control px-3" />
          <Button type="submit" variant="outline">
            {text.searchApply}
          </Button>
        </div>
      </form>
      <QueryState query={query} isEmpty={(result) => result.total === 0} empty={<EmptyState title={text.empty} />}>
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="text-sm text-muted-foreground">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {result.items.slice(0, PRODUCTS_PAGE_SIZE).map((item) => (
                  <li key={item.id}>
                    <Card className="relative h-full">
                      <CardHeader>
                        <CardTitle>
                          <h2 className="text-base">
                            <Link href={`/admin/catalogue/${item.id}`} className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                              {format(text.edit, { name: format(text.fullName, { brand: item.brand, model: item.model }) })}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription>{item.kind === "panel" ? (item.wattage_w ? format(text.watts, { value: item.wattage_w }) : text.unknown) : item.capacity_kw ? format(text.kilowatts, { value: item.capacity_kw }) : text.unknown}</CardDescription>
                      </CardHeader>
                    </Card>
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
