import type { Metadata } from "next";

import { ArticleEditor } from "@/components/education/article-editor";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminEducation };

export default function NewArticlePage() {
  return <ArticleEditor id={null} />;
}
