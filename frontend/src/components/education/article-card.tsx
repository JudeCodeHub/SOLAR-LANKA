import Link from "next/link";

import { Badges } from "@/components/education/article-notice";
import { Photo } from "@/components/ui/photo";
import { formatLongDate } from "@/lib/catalogue/detail";
import type { ArticleSummary } from "@/lib/education/hooks";
import { articlePhoto } from "@/lib/landing/format";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.education;

/** One guide: its photo, topic, title, summary, date and notices; the whole card opens it, and the first guide can be shown large. */
export function ArticleCard({ item, position, featured }: { item: ArticleSummary; position: number; featured: boolean }) {
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
          <Link href={`/learn/${item.slug}`} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
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
