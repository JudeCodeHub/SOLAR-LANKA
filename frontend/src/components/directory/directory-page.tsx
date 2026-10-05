import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/catalogue/pagination";
import { CompanyCard } from "@/components/directory/company-card";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { offsetFor, pageInfo } from "@/lib/catalogue/params";
import { DIRECTORY_PATH } from "@/lib/directory/links";
import { loadDirectory } from "@/lib/directory/load";
import {
  buildDirectoryHref,
  needsCanonicalRedirect,
  parseDirectoryParams,
  type RawParams,
} from "@/lib/directory/params";
import { format, messages } from "@/messages";

const text = messages.directory;

/** The company directory: a function of its address, like the catalogue lists. */
export async function DirectoryPage({ searchParams }: { searchParams: RawParams }) {
  const state = parseDirectoryParams(searchParams);
  if (needsCanonicalRedirect(searchParams, state)) {
    redirect(buildDirectoryHref(DIRECTORY_PATH, state));
  }
  const result = await loadDirectory(state.apiQuery, state.page);
  if (result.ok && result.total > 0 && offsetFor(state.page) >= result.total) {
    redirect(
      buildDirectoryHref(DIRECTORY_PATH, {
        values: state.values,
        page: pageInfo(result.total, state.page).page,
      }),
    );
  }
  const listHref = buildDirectoryHref(DIRECTORY_PATH, state);
  const filtered = Object.keys(state.apiQuery).length > 0;
  const info = result.ok ? pageInfo(result.total, state.page) : null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>

      <DirectoryFilters basePath={DIRECTORY_PATH} state={state} />

      <section aria-labelledby="results-title" className="space-y-4">
        <h2 id="results-title" className="sr-only">
          {text.results.heading}
        </h2>
        {Object.keys(state.errors).length > 0 ? (
          <p role="status" className="text-sm text-destructive">
            {text.invalidIgnored}
          </p>
        ) : null}
        {!result.ok ? (
          <SectionUnavailable />
        ) : result.total === 0 ? (
          <EmptyState
            title={filtered ? text.results.noneTitle : text.results.emptyTitle}
            description={filtered ? text.results.none : text.results.empty}
            action={
              filtered ? (
                <Link href={DIRECTORY_PATH} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">{text.filters.clear}</Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {format(text.results.showing, {
                from: info?.from ?? 0,
                to: info?.to ?? 0,
                total: result.total,
              })}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((company) => (
                <li key={company.id}>
                  <CompanyCard company={company} listHref={listHref} />
                </li>
              ))}
            </ul>
            <Pagination
              hrefFor={(target) =>
                buildDirectoryHref(DIRECTORY_PATH, { values: state.values, page: target })
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
