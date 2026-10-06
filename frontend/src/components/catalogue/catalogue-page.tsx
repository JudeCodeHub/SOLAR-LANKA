import { PackageOpen, SearchX } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogueFilters } from "@/components/catalogue/catalogue-filters";
import { Pagination } from "@/components/catalogue/pagination";
import { ProductCard } from "@/components/catalogue/product-card";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { loadCatalogue } from "@/lib/catalogue/load";
import {
  buildCatalogueHref,
  type CatalogueKind,
  needsCanonicalRedirect,
  offsetFor,
  pageInfo,
  parseCatalogueParams,
  type RawParams,
} from "@/lib/catalogue/params";
import { format, messages } from "@/messages";

/** A catalogue list page. */
export async function CataloguePage({
  kind,
  basePath,
  searchParams,
}: {
  kind: CatalogueKind;
  basePath: string;
  searchParams: RawParams;
}) {
  const state = parseCatalogueParams(kind, searchParams);
  // A submitted form leaves blank parameters behind; keep shared addresses clean.
  if (needsCanonicalRedirect(kind, searchParams, state)) {
    redirect(buildCatalogueHref(basePath, kind, state));
  }
  const result = await loadCatalogue(kind, state.apiQuery, state.page);
  const copy = kind === "panel" ? messages.catalogue.panels : messages.catalogue.inverters;
  const text = messages.catalogue.results;

  // An address that points past the last page.
  if (result.ok && result.total > 0 && offsetFor(state.page) >= result.total) {
    redirect(
      buildCatalogueHref(basePath, kind, {
        values: state.values,
        page: pageInfo(result.total, state.page).page,
      }),
    );
  }

  const listHref = buildCatalogueHref(basePath, kind, state);
  const filtered = Object.keys(state.apiQuery).length > 0;
  const hasInvalid = Object.keys(state.errors).length > 0;
  const info = result.ok ? pageInfo(result.total, state.page) : null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6" data-catalogue-list={kind}>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />

      <CatalogueFilters kind={kind} basePath={basePath} state={state} />

      <section aria-labelledby="results-title" className="space-y-4">
        <h2 id="results-title" className="sr-only">
          {text.heading}
        </h2>
        {hasInvalid ? (
          <p role="status" className="text-sm font-medium text-danger">
            {messages.catalogue.errors.invalidIgnored}
          </p>
        ) : null}
        {!result.ok ? (
          <SectionUnavailable />
        ) : result.total === 0 ? (
          <EmptyState
            title={filtered ? text.noneTitle : messages.states.emptyTitle}
            description={
              filtered
                ? `${format(text.none, { noun: copy.resultsNoun })} ${text.noneHelp}`
                : format(text.empty, { noun: copy.resultsNoun })
            }
            icon={filtered ? SearchX : PackageOpen}
            action={
              filtered ? (
                <Button asChild variant="outline">
                  <Link href={basePath}>{messages.catalogue.filters.clear}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="type-small text-ink-2">
              {format(text.showing, {
                from: info?.from ?? 0,
                to: info?.to ?? 0,
                total: result.total,
                noun: copy.resultsNoun,
              })}
            </p>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} listHref={listHref} />
                </li>
              ))}
            </ul>
            <Pagination
              hrefFor={(target) =>
                buildCatalogueHref(basePath, kind, { values: state.values, page: target })
              }
              page={info?.page ?? 1}
              pageCount={info?.pageCount ?? 1}
            />
          </>
        )}
      </section>
    </div>
  );
}
