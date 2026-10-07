"use client";

import { ArticleFormView } from "@/components/education/article-editor";

const DRAFT = {
  id: "a1", category_id: "c1", slug: "how-rooftop-solar-works", title: "How rooftop solar works", summary: "From sunlight to power.", body: "Plain words.\n\nA second paragraph.",
  sources: [{ title: "Fictional guide", publisher: "Demo Publisher", url: "https://example.org/guide", accessed_on: "2026-09-28" }],
  time_sensitive: true, valid_as_of: "2026-09-01", review_by: "2027-03-01", is_sample: true, status: "draft", author_id: "me", reviewer_id: null, reviewed_on: null, updated_at: "2026-10-01T08:00:00Z", published_at: null,
} as never;

/** The article form with a sample draft written by the viewer, for the design page; nothing here is sent. */
export function ArticleFormDemo() {
  return (
    <div className="max-w-3xl" data-article-form-sample>
      <ArticleFormView id="a1" article={DRAFT} selfId="me" />
    </div>
  );
}
