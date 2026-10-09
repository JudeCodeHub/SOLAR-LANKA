import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleView } from "@/components/education/article-view";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.article };

export default async function ArticlePage(props: PageProps<"/learn/[slug]">) {
  const { slug } = await props.params;
  // A malformed address can never name an article, so do not ask the backend.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) notFound();
  return <ArticleView slug={slug} />;
}
