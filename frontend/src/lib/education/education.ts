/** Rules for showing educational content safely and for writing it correctly. */
import { messages } from "../../messages/index.ts";

const text = messages.education;

/** The body as paragraphs: it is plain text, never HTML, so every line is shown as text. */
export function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part !== "");
}

export type Currency = "current" | "time-sensitive" | "overdue";

/** Whether an article depends on something that can change, and whether it is past its review date. */
export function currency(article: { time_sensitive: boolean; review_overdue: boolean }): Currency {
  if (!article.time_sensitive) return "current";
  return article.review_overdue ? "overdue" : "time-sensitive";
}

export function currencyLabel(state: Currency): string | null {
  if (state === "current") return null;
  return state === "overdue" ? text.overdueBadge : text.timeSensitiveBadge;
}

/** A readable address for a title: lower case words joined by dashes. */
export function slugify(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SourceRow {
  title: string;
  publisher: string;
  url: string;
  accessed_on: string;
}

export const emptySource = (): SourceRow => ({ title: "", publisher: "", url: "", accessed_on: "" });

export interface ArticleForm {
  category_id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  sources: SourceRow[];
  time_sensitive: boolean;
  valid_as_of: string;
  review_by: string;
  is_sample: boolean;
}

const E = messages.adminEducation.errors;

/** Problems by field (sources as "sources.0.url"), empty when the form can be saved as a draft. */
export function validateArticle(form: ArticleForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.category_id) errors.category_id = E.category;
  if (!SLUG.test(form.slug) || form.slug.length > 80) errors.slug = E.slug;
  if (form.title.trim() === "") errors.title = E.title;
  if (form.title.length > 200) errors.title = E.tooLong;
  if (form.summary.length > 500) errors.summary = E.tooLong;
  if (form.body.length > 20000) errors.body = E.tooLong;
  form.sources.forEach((source, index) => {
    const key = (field: string) => `sources.${index}.${field}`;
    if (source.title.trim() === "") errors[key("title")] = E.sourceTitle;
    if (source.publisher.trim() === "") errors[key("publisher")] = E.sourcePublisher;
    if (!/^https?:\/\//i.test(source.url.trim())) errors[key("url")] = E.sourceUrl;
    if (!DATE.test(source.accessed_on)) errors[key("accessed_on")] = E.date;
  });
  if (form.time_sensitive) {
    if (!DATE.test(form.valid_as_of)) errors.valid_as_of = E.date;
    if (!DATE.test(form.review_by)) errors.review_by = E.date;
    else if (DATE.test(form.valid_as_of) && form.review_by <= form.valid_as_of) errors.review_by = E.reviewAfter;
  }
  return errors;
}

/** The request body: empty optional dates are omitted and text is trimmed. */
export function articleBody(form: ArticleForm) {
  return {
    category_id: form.category_id,
    slug: form.slug,
    title: form.title.trim(),
    summary: form.summary.trim(),
    body: form.body.trim(),
    sources: form.sources.map((s) => ({ title: s.title.trim(), publisher: s.publisher.trim(), url: s.url.trim(), accessed_on: s.accessed_on })),
    time_sensitive: form.time_sensitive,
    valid_as_of: form.time_sensitive ? form.valid_as_of : null,
    review_by: form.time_sensitive ? form.review_by : null,
    is_sample: form.is_sample,
  };
}

/** What the person may do to an article in this status, mirroring the backend. */
export function actionsFor(status: string, reviewed: boolean): { edit: boolean; review: boolean; publish: boolean; unpublish: boolean; archive: boolean } {
  return {
    edit: status === "draft",
    review: status === "draft" && !reviewed,
    publish: status === "draft" && reviewed,
    unpublish: status === "published" || status === "archived",
    archive: status === "draft" || status === "published",
  };
}

export function statusLabel(status: string): string {
  return (messages.adminEducation.statuses as Record<string, string>)[status] ?? status;
}
