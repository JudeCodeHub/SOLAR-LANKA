import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleEditor } from "@/components/education/article-editor";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminEducation };

export default async function EditArticlePage(props: PageProps<"/admin/education/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name an article, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <ArticleEditor id={id} />;
}
