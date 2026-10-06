"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { ProductCard } from "@/components/catalogue/product-card";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { useFavouritesPage } from "@/lib/favourites/hooks";
import { format, messages } from "@/messages";

const text = messages.favourites.page;
const hrefFor = (page: number) => (page > 1 ? `/my/favourites?page=${page}` : "/my/favourites");

/** The customer's saved products, straight from the API. */
export function FavouritesView() {
  const router = useRouter();
  const page = parsePageParam(useSearchParams().get("page") ?? undefined);
  const query = useFavouritesPage(page);

  // Removing the last product on a later page leaves it empty: step back to the last page.
  const data = query.data;
  const lastPage = data ? pageInfo(data.total, page).page : page;
  useEffect(() => {
    if (data && data.total > 0 && data.items.length === 0 && lastPage !== page) {
      router.replace(hrefFor(lastPage));
    }
  }, [data, lastPage, page, router]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={
          <EmptyState
            title={text.emptyTitle}
            description={text.emptyDescription}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/panels">{text.browsePanels}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/inverters">{text.browseInverters}</Link>
                </Button>
              </div>
            }
          />
        }
      >
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="type-small text-ink-2">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-favourites>
                {result.items.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} listHref="/my/favourites" headingLevel="h3" />
                  </li>
                ))}
              </ul>
              <Pagination hrefFor={hrefFor} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
