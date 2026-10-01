import Link from "next/link";
import { redirect } from "next/navigation";

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

/**
 * A catalogue list page. Everything the visitor chose is in the address, so this page is just a
 * function of it: the same address always shows the same view, it can be shared or bookmarked,
 * and the back button restores it.
 */
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

  // An address that points past the last page (data changed, or a typed number) goes to the
  // last page that exists, keeping the filters.
  if (result.ok && result.total > 0 && offsetFor(state.page) >= result.total) {
    redirect(
      buildCatalogueHref(basePath, kind, {
        values: state.values,
        page: pageInfo(result.total, state.page).page,
      }),
    );
  }

  const filtered = Object.keys(state.apiQuery).length > 0;
  const hasInvalid = Object.keys(state.errors).length > 0;
  const info = result.ok ? pageInfo(result.total, state.page) : null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{copy.intro}</p>
      </header>

      <CatalogueFilters kind={kind} basePath={basePath} state={state} />

      <section aria-labelledby="results-title" className="space-y-4">
        <h2 id="results-title" className="sr-only">
          {text.heading}
        </h2>
        {hasInvalid ? (
          <p role="status" className="text-sm text-destructive">
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
            action={
              filtered ? (
                <Link href={basePath} className="text-sm underline underline-offset-2">
                  {messages.catalogue.filters.clear}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {format(text.showing, {
                from: info?.from ?? 0,
                to: info?.to ?? 0,
                total: result.total,
                noun: copy.resultsNoun,
              })}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
            <Pagination
              basePath={basePath}
              kind={kind}
              values={state.values}
              page={info?.page ?? 1}
              pageCount={info?.pageCount ?? 1}
            />
          </>
        )}
      </section>
    </div>
  );
}
