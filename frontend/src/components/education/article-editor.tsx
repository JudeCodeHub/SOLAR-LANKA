"use client";

import { Dropdown } from "@/components/ui/dropdown";
import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, CircleCheck, Lock, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { actionsFor, type ArticleForm, articleBody, emptySource, slugify, statusLabel, validateArticle } from "@/lib/education/education";
import { type AdminArticle, useAdminArticle, useCategories, useEducationActions } from "@/lib/education/hooks";
import { format, messages } from "@/messages";

const text = messages.adminEducation;
const f = text.fields;

const blank: ArticleForm = { category_id: "", slug: "", title: "", summary: "", body: "", sources: [emptySource()], time_sensitive: false, valid_as_of: "", review_by: "", is_sample: true };
const toForm = (a: AdminArticle): ArticleForm => ({
  category_id: a.category_id, slug: a.slug, title: a.title, summary: a.summary, body: a.body,
  sources: a.sources.length > 0 ? a.sources.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url, accessed_on: s.accessed_on })) : [emptySource()],
  time_sensitive: a.time_sensitive, valid_as_of: a.valid_as_of ?? "", review_by: a.review_by ?? "", is_sample: a.is_sample,
}); // fmt: skip

/** Write or change one article, review it, and move it between draft, published and archived. */
export function ArticleEditor({ id }: { id: string | null }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/admin/education">{text.back}</BackLink>
      <PlatformGate>{(selfId) => (id === null ? <ArticleFormView id={null} article={null} selfId={selfId} /> : <Loader id={id} selfId={selfId} />)}</PlatformGate>
    </div>
  );
}

function Loader({ id, selfId }: { id: string; selfId: string }) {
  const query = useAdminArticle(id);
  return (
    <QueryState query={query}>
      {(article) => <ArticleFormView key={`${article.id}-${article.status}-${article.reviewer_id}-${article.updated_at}`} id={id} article={article} selfId={selfId} />}
    </QueryState>
  );
}

/** The article form with its sources, flags and the review, publish and archive actions, shown once the article (or none, for a new one) is known. */
export function ArticleFormView({ id, article, selfId }: { id: string | null; article: AdminArticle | null; selfId: string }) {
  const router = useRouter();
  const categories = useCategories();
  const actions = useEducationActions(id);
  const busy = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<ArticleForm>(article ? toForm(article) : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);
  const status = article?.status ?? "draft";
  const can = actionsFor(status, Boolean(article?.reviewer_id));
  const editable = article === null || can.edit;
  const set = <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const begin = () => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return false;
    busy.current = true;
    setNotice(null);
    setFailure(null);
    setRefused(false);
    return true;
  };
  const handlers = (message: string) => ({
    onSuccess: () => {
      busy.current = false;
      setNotice(message);
    },
    onError: (error: ApiError) => {
      busy.current = false;
      if (error.status === 409 || error.status === 404) setRefused(true);
      else setFailure(error);
    },
  });

  const save = () => {
    const found = validateArticle(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    if (!begin()) return;
    const body = articleBody(form);
    if (id === null) {
      actions.create.mutate(body, {
        onSuccess: (created) => {
          busy.current = false;
          router.push(`/admin/education/${created.id}`);
        },
        onError: handlers("").onError,
      });
    } else {
      actions.save.mutate(body, handlers(text.saved));
    }
  };

  const text_ = (key: keyof ArticleForm, label: string, options: { area?: boolean; help?: string; type?: string } = {}) => {
    const fid = `a-${key}`;
    const error = errors[key];
    const common = { id: fid, value: String(form[key]), readOnly: !editable, "aria-invalid": Boolean(error), "aria-describedby": [options.help ? `${fid}-help` : "", error ? `${fid}-error` : ""].filter(Boolean).join(" ") || undefined };
    return (
      <div className="space-y-1.5" key={key}>
        <label htmlFor={fid} className="block font-medium text-ink">
          {label}
        </label>
        {options.area ? (
          <textarea {...common} rows={key === "body" ? 14 : 3} onChange={(event) => set(key, event.target.value as never)} className="w-full field-control p-3" />
        ) : (
          <input {...common} type={options.type ?? "text"} onChange={(event) => set(key, event.target.value as never)} className="h-11 w-full field-control px-3" />
        )}
        {options.help ? <p id={`${fid}-help`} className="text-ink-2">{options.help}</p> : null}
        {error ? <p id={`${fid}-error`} className="flex items-center gap-1.5 font-medium text-danger" data-error={key}><CircleAlert aria-hidden className="size-4 shrink-0" />{error}</p> : null}
      </div>
    );
  };

  return (
    <>
      <PageHeader eyebrow={text.editorEyebrow} title={article ? article.title : text.newArticle} />
      {article ? (
        <p data-status>
          <Badge variant={status === "published" ? "success" : "neutral"}>{statusLabel(status)}</Badge>
        </p>
      ) : null}
      {!editable ? (
        <Alert variant="warning" role="note" data-read-only>
          <Lock aria-hidden />
          <AlertDescription className="text-ink">{text.readOnly}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" role="status" data-notice>
          <CircleCheck aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{text.refused}</AlertDescription>
        </Alert>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      {Object.keys(errors).length > 0 ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-card border-2 border-danger bg-danger-tint p-4 text-sm font-medium text-ink outline-none" data-error-summary>
          <p>{text.summary}</p>
          <ul className="list-disc pl-5">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <form
        noValidate
        className="space-y-5 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (editable) save();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="a-category" className="block font-medium text-ink">
            {f.category}
          </label>
          <Dropdown id="a-category" value={form.category_id} disabled={!editable} onChange={(event) => set("category_id", event.target.value)} aria-invalid={Boolean(errors.category_id)} className="h-11 w-full field-control px-3">
            <option value="">{f.chooseCategory}</option>
            {(categories.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Dropdown>
          {errors.category_id ? <p className="flex items-center gap-1.5 font-medium text-danger" data-error="category_id"><CircleAlert aria-hidden className="size-4 shrink-0" />{errors.category_id}</p> : null}
        </div>
        {text_("title", f.title)}
        <div className="space-y-1">
          {text_("slug", f.slug, { help: f.slugHelp })}
          {editable && form.slug === "" && form.title.trim() !== "" ? (
            <Button type="button" variant="outline" onClick={() => set("slug", slugify(form.title))}>
              {slugify(form.title)}
            </Button>
          ) : null}
        </div>
        {text_("summary", f.summary, { area: true, help: f.summaryHelp })}
        {text_("body", f.body, { area: true, help: f.bodyHelp })}
        <fieldset className="space-y-4 rounded-card border border-line bg-paper p-4 sm:p-5">
          <legend className="type-subheading px-2 text-ink">{f.sources}</legend>
          <p className="text-ink-2">{f.sourcesHelp}</p>
          {form.sources.map((source, index) => (
            <div key={index} className="grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2" data-source-row={index}>
              <p className="font-medium text-ink sm:col-span-2">{format(f.sourceLegend, { number: index + 1 })}</p>
              {(
                [
                  ["title", f.sourceTitle, "text"],
                  ["publisher", f.sourcePublisher, "text"],
                  ["url", f.sourceUrl, "text"],
                  ["accessed_on", f.sourceDate, "date"],
                ] as const
              ).map(([key, label, type]) => {
                const fid = `s-${index}-${key}`;
                const error = errors[`sources.${index}.${key}`];
                return (
                  <div key={key} className="space-y-1.5">
                    <label htmlFor={fid} className="block font-medium text-ink">
                      {label}
                    </label>
                    <input id={fid} type={type} value={source[key]} readOnly={!editable} aria-invalid={Boolean(error)} aria-describedby={error ? `${fid}-error` : undefined} onChange={(event) => set("sources", form.sources.map((row, i) => (i === index ? { ...row, [key]: event.target.value } : row)))} className="h-11 w-full field-control px-3" />
                    {error ? <p id={`${fid}-error`} className="flex items-center gap-1.5 font-medium text-danger" data-error={`sources.${index}.${key}`}><CircleAlert aria-hidden className="size-4 shrink-0" />{error}</p> : null}
                  </div>
                );
              })}
              {editable && form.sources.length > 1 ? (
                <Button type="button" variant="outline" className="sm:col-span-2 sm:w-fit" onClick={() => set("sources", form.sources.filter((_, i) => i !== index))}>
                  {format(f.removeSource, { number: index + 1 })}
                </Button>
              ) : null}
            </div>
          ))}
          {editable && form.sources.length < 10 ? (
            <Button type="button" variant="outline" onClick={() => set("sources", [...form.sources, emptySource()])}>
              {f.addSource}
            </Button>
          ) : null}
        </fieldset>
        <fieldset className="space-y-3">
          <div className="rounded-card border border-line bg-paper p-4 has-[:checked]:border-warning has-[:checked]:bg-warning-tint" data-time-sensitive-box>
          <label className="flex min-h-11 items-center gap-3 font-medium text-ink">
            <input type="checkbox" checked={form.time_sensitive} disabled={!editable} onChange={(event) => set("time_sensitive", event.target.checked)} aria-describedby="ts-help" className="field-check size-6 shrink-0" />
            <span>{f.timeSensitive}</span>
          </label>
          <p id="ts-help" className="text-ink-2">{f.timeSensitiveHelp}</p>
          </div>
          {form.time_sensitive ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {text_("valid_as_of", f.validAsOf, { type: "date" })}
              {text_("review_by", f.reviewBy, { type: "date" })}
            </div>
          ) : null}
          <div className="rounded-card border border-line bg-paper p-4 has-[:checked]:border-info has-[:checked]:bg-info-tint" data-sample-box>
            <label className="flex min-h-11 items-center gap-3 font-medium text-ink">
              <input type="checkbox" checked={form.is_sample} disabled={!editable} onChange={(event) => set("is_sample", event.target.checked)} className="field-check size-6 shrink-0" />
              <span>{f.sample}</span>
            </label>
          </div>
        </fieldset>
        {editable ? (
          <Button type="submit" size="lg" aria-disabled={actions.create.isPending || actions.save.isPending} data-action="save">
            {actions.create.isPending || actions.save.isPending ? text.saving : article ? text.save : text.create}
          </Button>
        ) : null}
      </form>
      {article ? (
        <section className="space-y-4 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2" data-actions>
          <p className="flex items-center gap-2 text-ink-2">{article.reviewed_on ? format(text.reviewedOn, { date: article.reviewed_on }) : text.notReviewed}</p>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            {can.review ? (
              <ConfirmAction id="review" variant="default" label={text.review} help={article.author_id === selfId ? undefined : text.reviewHelp} title={text.reviewTitle} body={text.reviewBody} yes={text.reviewYes} keep={text.keep} disabled={actions.review.isPending || article.author_id === selfId} onConfirm={() => begin() && actions.review.mutate(undefined, handlers(text.done))} />
            ) : null}
            {can.publish ? (
              <ConfirmAction id="publish" variant="default" label={text.publish} title={text.publishTitle} body={text.publishBody} yes={text.publishYes} keep={text.keep} disabled={actions.publish.isPending} onConfirm={() => begin() && actions.publish.mutate(undefined, handlers(text.done))} />
            ) : null}
            {can.unpublish ? (
              <ConfirmAction id="unpublish" label={text.unpublish} title={text.unpublishTitle} body={text.unpublishBody} yes={text.unpublishYes} keep={text.keep} disabled={actions.unpublish.isPending} onConfirm={() => begin() && actions.unpublish.mutate(undefined, handlers(text.done))} />
            ) : null}
            {can.archive ? (
              <ConfirmAction id="archive" label={text.archive} title={text.archiveTitle} body={text.archiveBody} yes={text.archiveYes} keep={text.keep} disabled={actions.archive.isPending} onConfirm={() => begin() && actions.archive.mutate(undefined, handlers(text.done))} />
            ) : null}
          </div>
          {article.author_id === selfId && can.review ? <p className="text-sm font-medium text-ink" data-own-work>{text.reviewHelp}</p> : null}
        </section>
      ) : null}
    </>
  );
}
