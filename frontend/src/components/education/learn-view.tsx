"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Pagination } from "@/components/catalogue/pagination";
import { Badges } from "@/components/education/article-notice";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate } from "@/lib/catalogue/detail";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { PAGE_SIZE, useArticles, useCategories } from "@/lib/education/hooks";
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
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <form
        role="search"
        className="space-y-1"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(hrefFor(draft.trim(), category, 1));
        }}
      >
        <label htmlFor="learn-search" className="block font-medium">
          {text.searchLabel}
        </label>
        <div className="flex gap-2">
          <input id="learn-search" value={draft} maxLength={100} onChange={(event) => setDraft(event.target.value)} aria-describedby="learn-search-help" className="h-11 min-w-0 flex-1 rounded-lg border bg-transparent px-3" />
          <Button type="submit" variant="outline">
            {text.search}
          </Button>
          {search ? (
            <Button asChild variant="outline">
              <Link href={hrefFor("", category, 1)}>{text.clear}</Link>
            </Button>
          ) : null}
        </div>
        <p id="learn-search-help" className="text-sm text-muted-foreground">
          {text.searchHelp}
        </p>
      </form>
      <nav aria-label={text.categoriesLabel} className="flex flex-wrap gap-2">
        <Button asChild variant={category === "" ? "default" : "outline"} size="sm">
          <Link href={hrefFor(search, "", 1)} aria-current={category === "" ? "page" : undefined}>
            {text.all}
          </Link>
        </Button>
        {(categories.data ?? []).map((item) => (
          <Button key={item.slug} asChild variant={category === item.slug ? "default" : "outline"} size="sm">
            <Link href={hrefFor(search, item.slug, 1)} aria-current={category === item.slug ? "page" : undefined}>
              {format(text.categoryLine, { name: item.name, count: item.article_count })}
            </Link>
          </Button>
        ))}
      </nav>
      <QueryState query={articles} isEmpty={(result) => result.total === 0} empty={<EmptyState title={text.none} description={text.noneHelp} />}>
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="text-sm text-muted-foreground" role="status">
                {format(text.showing, { from: info.from, to: info.to, total: result.total })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2" data-articles>
                {result.items.map((item) => (
                  <li key={item.id}>
                    <Card className="relative h-full" data-article={item.slug}>
                      <CardHeader>
                        <CardTitle>
                          <h2 className="text-base">
                            <Link href={`/learn/${item.slug}`} className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                              {item.title}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription className="space-y-1">
                          <span className="block">{item.summary}</span>
                          <span className="block">{item.category_name}</span>
                          <span className="block">{format(text.published, { date: formatLongDate(item.published_at) ?? item.published_at })}</span>
                          <Badges article={item} />
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </li>
                ))}
              </ul>
              <Pagination hrefFor={(target) => hrefFor(search, category, target)} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
