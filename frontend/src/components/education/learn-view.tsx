"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { Badges } from "@/components/education/article-notice";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Photo } from "@/components/ui/photo";
import { formatLongDate } from "@/lib/catalogue/detail";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { PAGE_SIZE, useArticles, useCategories, type ArticleSummary } from "@/lib/education/hooks";
import { articlePhoto } from "@/lib/landing/format";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.education;

const hrefFor = (search: string, category: string, page: number) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/learn?${query}` : "/learn";
};

/** The learning centre: search, topics and the published articles. */
export function LearnView() {
  const router = useRouter();
  const params = useSearchParams();
  const search = (params.get("search") ?? "").slice(0, 100);
  const category = /^[a-z0-9-]{1,80}$/.test(params.get("category") ?? "") ? (params.get("category") ?? "") : "";
  const page = parsePageParam(params.get("page") ?? undefined);
  const [draft, setDraft] = useState(search);
  const categories = useCategories();
  const articles = useArticles(search, category, page);
  void PAGE_SIZE;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <form
        role="search"
        className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-e1"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(hrefFor(draft.trim(), category, 1));
        }}
      >
        <label htmlFor="learn-search" className="type-subheading block text-ink">
          {text.searchLabel}
        </label>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1 basis-60">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-3" />
            <input id="learn-search" value={draft} maxLength={100} onChange={(event) => setDraft(event.target.value)} aria-describedby="learn-search-help" className="field-control h-11 w-full pr-3 pl-11" />
          </div>
          <Button type="submit">{text.search}</Button>
          {search ? (
            <Button asChild variant="outline">
              <Link href={hrefFor("", category, 1)}>{text.clear}</Link>
            </Button>
          ) : null}
        </div>
        <p id="learn-search-help" className="type-small text-ink-2">
          {text.searchHelp}
        </p>
      </form>
      <nav aria-label={text.categoriesLabel}>
        <ul className="flex flex-wrap gap-2">
          {[{ slug: "", label: text.all }, ...(categories.data ?? []).map((item) => ({ slug: item.slug, label: format(text.categoryLine, { name: item.name, count: item.article_count }) }))].map((item) => {
            const current = category === item.slug;
            return (
              <li key={item.slug || "all"}>
                <Link
                  href={hrefFor(search, item.slug, 1)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                    current ? "border-orange bg-orange text-on-orange" : "border-line bg-paper-2 text-ink hover:bg-orange-tint",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <QueryState query={articles} isEmpty={(result) => result.total === 0} empty={<EmptyState title={text.none} description={text.noneHelp} />}>
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="type-small text-ink-2" role="status">
                {format(text.showing, { from: info.from, to: info.to, total: result.total })}
              </p>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-articles>
                {result.items.map((item, index) => {
                  const featured = index === 0 && page === 1 && search === "" && category === "" && result.items.length > 1;
                  return (
                    <li key={item.id} className={featured ? "sm:col-span-2 lg:col-span-3" : undefined}>
                      <ArticleCard item={item} position={index} featured={featured} />
                    </li>
                  );
                })}
              </ul>
              <Pagination hrefFor={(target) => hrefFor(search, category, target)} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}

/** One guide: its photo, topic, title, summary, date and notices; the whole card opens it, and the first guide can be shown large. */
function ArticleCard({ item, position, featured }: { item: ArticleSummary; position: number; featured: boolean }) {
  return (
    <article
      data-article={item.slug}
      data-featured={featured ? "" : undefined}
      className={cn("group relative flex h-full overflow-hidden rounded-card border border-line bg-surface shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none", featured ? "flex-col md:flex-row" : "flex-col")}
    >
      <div aria-hidden className={cn("overflow-hidden bg-paper-2", featured ? "md:w-1/2" : "")}>
        <Photo name={articlePhoto(item.slug, position)} sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"} className="aspect-[16/10] h-full w-full object-cover" />
      </div>
      <div className={cn("flex flex-1 flex-col gap-2 p-5", featured ? "md:w-1/2 md:justify-center md:p-8" : "")}>
        <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{item.category_name}</p>
        <h2 className={featured ? "type-heading text-ink" : "type-subheading text-ink"}>
          <Link href={`/learn/${item.slug}`} className="rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
            {item.title}
          </Link>
        </h2>
        <p className="type-body text-ink-2">{item.summary}</p>
        <p className="type-small mt-auto text-ink-2">{format(text.published, { date: formatLongDate(item.published_at) ?? item.published_at })}</p>
        <Badges article={item} />
      </div>
    </article>
  );
}
