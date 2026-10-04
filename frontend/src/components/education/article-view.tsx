"use client";

import Link from "next/link";

import { Badges, CurrencyNotice } from "@/components/education/article-notice";
import { QueryState } from "@/components/query-state";
import { formatLongDate } from "@/lib/catalogue/detail";
import { paragraphs } from "@/lib/education/education";
import { useArticle } from "@/lib/education/hooks";
import { format, messages } from "@/messages";

const text = messages.education;
const day = (iso: string) => formatLongDate(iso) ?? iso;

/** One published article: its text as plain paragraphs, its currency, its sources and related articles. */
export function ArticleView({ slug }: { slug: string }) {
  const query = useArticle(slug);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/learn" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <QueryState query={query} isEmpty={() => false}>
        {(article) => (
          <article className="space-y-6" data-article-page>
            <header className="space-y-2">
              <p className="text-sm text-muted-foreground">{article.category_name}</p>
              <h1 className="font-heading text-3xl font-semibold tracking-tight">{article.title}</h1>
              <p className="text-lg text-muted-foreground">{article.summary}</p>
              <p className="text-sm text-muted-foreground">
                {format(text.publishedReviewed, { published: day(article.published_at), reviewed: day(article.reviewed_on) })}
              </p>
              <Badges article={article} />
            </header>
            <CurrencyNotice article={article} />
            {article.is_sample ? <p className="text-sm text-muted-foreground">{text.sampleNote}</p> : null}
            <div className="space-y-4" lang={article.language} data-body>
              {paragraphs(article.body).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line leading-7">
                  {paragraph}
                </p>
              ))}
            </div>
            <section aria-labelledby="sources-title" className="space-y-2">
              <h2 id="sources-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.sourcesTitle}
              </h2>
              <ul className="space-y-1 text-sm" data-sources>
                {article.sources.map((source) => (
                  <li key={source.url}>
                    <p>{format(text.sourceLine, { title: source.title, publisher: source.publisher, date: day(source.accessed_on) })}</p>
                    <a href={source.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center underline underline-offset-2">
                      {format(text.openSource, { title: source.title })}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="related-title" className="space-y-2">
              <h2 id="related-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.relatedTitle}
              </h2>
              {article.related.length === 0 ? (
                <p className="text-sm text-muted-foreground">{text.noRelated}</p>
              ) : (
                <ul className="space-y-1 text-sm" data-related>
                  {article.related.map((item) => (
                    <li key={item.id}>
                      <Link href={`/learn/${item.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>
        )}
      </QueryState>
    </div>
  );
}
