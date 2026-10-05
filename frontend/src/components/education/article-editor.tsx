"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/admin/education" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
      <PlatformGate>{(selfId) => (id === null ? <Form id={null} article={null} selfId={selfId} /> : <Loader id={id} selfId={selfId} />)}</PlatformGate>
    </div>
  );
}

function Loader({ id, selfId }: { id: string; selfId: string }) {
  const query = useAdminArticle(id);
  return (
    <QueryState query={query}>
      {(article) => <Form key={`${article.id}-${article.status}-${article.reviewer_id}-${article.updated_at}`} id={id} article={article} selfId={selfId} />}
    </QueryState>
  );
}

function Form({ id, article, selfId }: { id: string | null; article: AdminArticle | null; selfId: string }) {
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
      <div className="space-y-1" key={key}>
        <label htmlFor={fid} className="block font-medium">
          {label}
        </label>
        {options.area ? (
          <textarea {...common} rows={key === "body" ? 14 : 3} onChange={(event) => set(key, event.target.value as never)} className="w-full field-control p-2" />
        ) : (
          <input {...common} type={options.type ?? "text"} onChange={(event) => set(key, event.target.value as never)} className="h-11 w-full field-control px-3" />
        )}
        {options.help ? <p id={`${fid}-help`} className="text-muted-foreground">{options.help}</p> : null}
        {error ? <p id={`${fid}-error`} className="font-medium text-destructive" data-error={key}>{error}</p> : null}
      </div>
    );
  };

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{article ? article.title : text.newArticle}</h1>
      {article ? (
        <p className="text-sm font-medium" data-status>
          {statusLabel(status)}
        </p>
      ) : null}
      {!editable ? <p className="text-sm" data-read-only>{text.readOnly}</p> : null}
      {notice ? <p role="status" className="text-sm font-medium" data-notice>{notice}</p> : null}
      {refused ? <p role="alert" className="text-sm font-medium" data-refused>{text.refused}</p> : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      {Object.keys(errors).length > 0 ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="text-sm font-medium outline-none" data-error-summary>
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
        className="space-y-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (editable) save();
        }}
      >
        <div className="space-y-1">
          <label htmlFor="a-category" className="block font-medium">
            {f.category}
          </label>
          <select id="a-category" value={form.category_id} disabled={!editable} onChange={(event) => set("category_id", event.target.value)} aria-invalid={Boolean(errors.category_id)} className="h-11 field-control field-select px-2">
            <option value="">{f.chooseCategory}</option>
            {(categories.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.category_id ? <p className="font-medium text-destructive" data-error="category_id">{errors.category_id}</p> : null}
        </div>
        {text_("title", f.title)}
        <div className="space-y-1">
          {text_("slug", f.slug, { help: f.slugHelp })}
          {editable && form.slug === "" && form.title.trim() !== "" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => set("slug", slugify(form.title))}>
              {slugify(form.title)}
            </Button>
          ) : null}
        </div>
        {text_("summary", f.summary, { area: true, help: f.summaryHelp })}
        {text_("body", f.body, { area: true, help: f.bodyHelp })}
        <fieldset className="space-y-3">
          <legend className="font-medium">{f.sources}</legend>
          <p className="text-muted-foreground">{f.sourcesHelp}</p>
          {form.sources.map((source, index) => (
            <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2" data-source-row={index}>
              <p className="font-medium sm:col-span-2">{format(f.sourceLegend, { number: index + 1 })}</p>
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
                  <div key={key} className="space-y-1">
                    <label htmlFor={fid} className="block font-medium">
                      {label}
                    </label>
                    <input id={fid} type={type} value={source[key]} readOnly={!editable} aria-invalid={Boolean(error)} aria-describedby={error ? `${fid}-error` : undefined} onChange={(event) => set("sources", form.sources.map((row, i) => (i === index ? { ...row, [key]: event.target.value } : row)))} className="h-11 w-full field-control px-3" />
                    {error ? <p id={`${fid}-error`} className="font-medium text-destructive" data-error={`sources.${index}.${key}`}>{error}</p> : null}
                  </div>
                );
              })}
              {editable && form.sources.length > 1 ? (
                <Button type="button" variant="outline" size="sm" className="sm:col-span-2 sm:w-fit" onClick={() => set("sources", form.sources.filter((_, i) => i !== index))}>
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
        <fieldset className="space-y-2">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={form.time_sensitive} disabled={!editable} onChange={(event) => set("time_sensitive", event.target.checked)} aria-describedby="ts-help" className="field-check size-6 shrink-0" />
            <span>{f.timeSensitive}</span>
          </label>
          <p id="ts-help" className="text-muted-foreground">{f.timeSensitiveHelp}</p>
          {form.time_sensitive ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {text_("valid_as_of", f.validAsOf, { type: "date" })}
              {text_("review_by", f.reviewBy, { type: "date" })}
            </div>
          ) : null}
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={form.is_sample} disabled={!editable} onChange={(event) => set("is_sample", event.target.checked)} className="field-check size-6 shrink-0" />
            <span>{f.sample}</span>
          </label>
        </fieldset>
        {editable ? (
          <Button type="submit" aria-disabled={actions.create.isPending || actions.save.isPending} data-action="save">
            {actions.create.isPending || actions.save.isPending ? text.saving : article ? text.save : text.create}
          </Button>
        ) : null}
      </form>
      {article ? (
        <section className="space-y-3" data-actions>
          <p className="text-sm text-muted-foreground">{article.reviewed_on ? format(text.reviewedOn, { date: article.reviewed_on }) : text.notReviewed}</p>
          <div className="flex flex-wrap items-start gap-3">
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
          {article.author_id === selfId && can.review ? <p className="text-sm" data-own-work>{text.reviewHelp}</p> : null}
        </section>
      ) : null}
    </>
  );
}
