"use client";

import { BackLink } from "@/components/ui/back-link";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Badges, CurrencyNotice, ReviewLine, SampleNotice } from "@/components/education/article-notice";
import { QueryState } from "@/components/query-state";
import { Photo } from "@/components/ui/photo";
import { formatLongDate } from "@/lib/catalogue/detail";
import { paragraphs } from "@/lib/education/education";
import { useArticle } from "@/lib/education/hooks";
import { articlePhoto } from "@/lib/landing/format";
import { format, messages } from "@/messages";

const text = messages.education;
const day = (iso: string) => formatLongDate(iso) ?? iso;

/** One published article: its text as plain paragraphs, its currency, its sources and related articles. */
export function ArticleView({ slug }: { slug: string }) {
  const query = useArticle(slug);
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/learn">{text.back}</BackLink>
      <QueryState query={query} isEmpty={() => false}>
        {(article) => (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <article className="min-w-0 max-w-reading space-y-8" data-article-page>
              <header className="space-y-4">
                <div className="overflow-hidden rounded-card border border-line bg-paper-2">
                  <Photo name={articlePhoto(article.slug, 0)} priority sizes="(min-width: 1024px) 640px, 100vw" className="aspect-[16/9] w-full object-cover" />
                </div>
                <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{article.category_name}</p>
                <h1 className="type-display-m text-ink">{article.title}</h1>
                <p className="type-body text-ink-2">{article.summary}</p>
                <ReviewLine article={article} published={day(article.published_at)} reviewed={day(article.reviewed_on)} />
                <Badges article={article} />
              </header>
              <CurrencyNotice article={article} />
              {article.is_sample ? <SampleNotice /> : null}
              <div id="article-body" className="scroll-mt-40 space-y-5" lang={article.language} data-body>
                {paragraphs(article.body).map((paragraph, index) => (
                  <p key={index} className="type-body whitespace-pre-line text-lg leading-8 text-ink">
                    {paragraph}
                  </p>
                ))}
              </div>
              <section aria-labelledby="sources-title" className="scroll-mt-40 space-y-3">
                <h2 id="sources-title" className="type-heading text-ink">
                  {text.sourcesTitle}
                </h2>
                <ul className="space-y-3 text-sm" data-sources>
                  {article.sources.map((source) => (
                    <li key={source.url} className="rounded-card border border-line bg-surface p-4">
                      <p className="text-ink-2">{format(text.sourceLine, { title: source.title, publisher: source.publisher, date: day(source.accessed_on) })}</p>
                      <a href={source.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
                        {format(text.openSource, { title: source.title })}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="related-title" className="scroll-mt-40 space-y-3">
                <h2 id="related-title" className="type-heading text-ink">
                  {text.relatedTitle}
                </h2>
                {article.related.length === 0 ? (
                  <p className="type-small text-ink-2">{text.noRelated}</p>
                ) : (
                  <ul className="space-y-2" data-related>
                    {article.related.map((item) => (
                      <li key={item.id}>
                        <Link href={`/learn/${item.slug}`} className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-2 font-medium text-ink hover:bg-orange-tint">
                          {item.title}
                          <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </article>
            <nav aria-label={text.contentsLabel} className="hidden lg:block" data-contents>
              <div className="sticky top-40 space-y-2">
                <p className="type-caption font-semibold tracking-widest text-ink-2 uppercase">{text.contentsTitle}</p>
                <ul className="space-y-1 border-l border-line">
                  {[
                    ["#article-body", text.contentsArticle],
                    ["#sources-title", text.sourcesTitle],
                    ["#related-title", text.relatedTitle],
                  ].map(([href, label]) => (
                    <li key={href}>
                      <a href={href} className="-ml-px flex min-h-11 items-center border-l-2 border-transparent pl-4 text-sm text-ink-2 hover:border-orange hover:text-ink">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>
        )}
      </QueryState>
    </div>
  );
}
