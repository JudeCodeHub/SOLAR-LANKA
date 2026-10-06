import { Building2, SearchX } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
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
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6" data-directory>
      <header className="relative isolate overflow-hidden rounded-panel border border-line bg-paper-2">
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 md:block">
          <Photo name="team" sizes="50vw" priority className="size-full object-cover dark:brightness-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-paper-2 via-paper-2/40 to-transparent" />
        </div>
        <div className="max-w-xl space-y-3 p-6 sm:p-10">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
          <h1 className="type-display-m text-ink">{text.title}</h1>
          <p className="type-body text-ink-2">{text.intro}</p>
        </div>
      </header>

      <DirectoryFilters basePath={DIRECTORY_PATH} state={state} />

      <section aria-labelledby="results-title" className="space-y-4">
        <h2 id="results-title" className="sr-only">
          {text.results.heading}
        </h2>
        {Object.keys(state.errors).length > 0 ? (
          <p role="status" className="text-sm font-medium text-danger">
            {text.invalidIgnored}
          </p>
        ) : null}
        {!result.ok ? (
          <SectionUnavailable />
        ) : result.total === 0 ? (
          <EmptyState
            title={filtered ? text.results.noneTitle : text.results.emptyTitle}
            description={filtered ? text.results.none : text.results.empty}
            icon={filtered ? SearchX : Building2}
            action={
              filtered ? (
                <Button asChild variant="outline">
                  <Link href={DIRECTORY_PATH}>{text.filters.clear}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="type-small text-ink-2">
              {format(text.results.showing, {
                from: info?.from ?? 0,
                to: info?.to ?? 0,
                total: result.total,
              })}
            </p>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
