import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SectionUnavailable } from "@/components/landing/section-unavailable";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import { Section as PageSection } from "@/components/ui/section";
import type { ArticleSummary } from "@/lib/education/hooks";
import { articlePhoto } from "@/lib/landing/format";
import type { Section } from "@/lib/landing/load";
import { messages } from "@/messages";

const text = messages.landing.story.learn;

/** Three guides from the learning centre, each with a photo, its category, a short summary and a link to the real article. */
export function LearningTeaser({ section }: { section: Section<ArticleSummary> }) {
  return (
    <PageSection space="l" labelledBy="learn-title">
      <Container size="content" className="space-y-10" data-learning-teaser>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-4">
            <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
            <h2 id="learn-title" className="type-display-m text-ink">{text.title}</h2>
            <p className="type-body text-ink-2">{text.body}</p>
          </div>
          <Link href="/learn" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-text underline-offset-4 hover:underline">
            {text.action}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        {!section.ok ? (
          <SectionUnavailable />
        ) : section.items.length === 0 ? (
          <EmptyState title={messages.education.none} description={messages.education.noneHelp} />
        ) : (
          <ul className="grid gap-6 md:grid-cols-3">
            {section.items.slice(0, 3).map((article, index) => (
              <li key={article.id}>
                <Card className="group/article relative h-full gap-0 overflow-hidden p-0 transition-shadow hover:shadow-e3 motion-reduce:transition-none" data-article={article.slug}>
                  <Photo name={articlePhoto(article.slug, index)} sizes="(min-width: 768px) 30vw, 100vw" className="aspect-[16/10] w-full object-cover" />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <Badge>{article.category_name}</Badge>
                    <h3 className="type-subheading text-ink">
                      <Link href={`/learn/${article.slug}`} className="underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="type-small line-clamp-3 text-ink-2">{article.summary}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageSection>
  );
}
