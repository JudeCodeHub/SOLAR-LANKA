"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { FavouriteControl } from "@/components/favourites/favourite-button";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BASE_PATH, detailHref } from "@/lib/catalogue/links";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { useFavouritesPage } from "@/lib/favourites/hooks";
import { productName } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.favourites.page;
const hrefFor = (page: number) => (page > 1 ? `/my/favourites?page=${page}` : "/my/favourites");

/**
 * The customer's saved products, straight from the API. The page number is in the address, the
 * list is the server's (nothing is kept locally), and removing a product here updates it at once.
 */
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
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={
          <EmptyState
            title={text.emptyTitle}
            description={text.emptyDescription}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/panels">{text.browsePanels}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
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
              <p className="text-sm text-muted-foreground">
                {format(text.showing, { from: info.from, to: info.to, total: result.total })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((product) => (
                  <li key={product.id}>
                    <Card className="relative h-full">
                      <CardHeader>
                        <CardDescription>{messages.landing.products.kind[product.kind]}</CardDescription>
                        <CardTitle>
                          <h2 className="text-base">
                            <Link
                              href={detailHref(product.kind, product.id, BASE_PATH[product.kind])}
                              className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                            >
                              {productName(product)}
                            </Link>
                          </h2>
                        </CardTitle>
                      </CardHeader>
                      <div className="absolute top-3 right-3 z-10">
                        <FavouriteControl id={product.id} name={productName(product)} signedIn />
                      </div>
                    </Card>
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
