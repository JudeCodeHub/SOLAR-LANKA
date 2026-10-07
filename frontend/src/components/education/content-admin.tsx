"use client";

import { BadgeCheck, CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { slugify, statusLabel } from "@/lib/education/education";
import { useAdminArticles, useCategories, useCreateCategory } from "@/lib/education/hooks";
import { format, messages } from "@/messages";

const text = messages.adminEducation;

/** All learning content for platform administrators, with topics. */
export function ContentAdmin() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <PlatformGate>{() => <Body />}</PlatformGate>
    </div>
  );
}

function Body() {
  const [status, setStatus] = useState("");
  const query = useAdminArticles(status);
  return (
    <>
      <Button asChild size="lg" className="w-fit">
        <Link href="/admin/education/new">{text.newArticle}</Link>
      </Button>
      <div className="space-y-1.5 rounded-card border border-line bg-surface p-5 shadow-e1">
        <label htmlFor="status" className="type-subheading block text-ink">
          {text.filter}
        </label>
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 w-full field-control field-select px-3 sm:w-auto sm:min-w-56">
          <option value="">{text.allStatuses}</option>
          {Object.entries(text.statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<EmptyState title={text.none} />}>
        {(items) => (
          <ul className="grid gap-4 sm:grid-cols-2" data-admin-articles>
            {items.map((item) => (
              <li key={item.id}>
                <article className="relative flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none" data-status={item.status}>
                  <Badge variant={item.status === "published" ? "success" : "neutral"} data-badge="status">
                    {statusLabel(item.status)}
                  </Badge>
                  <h2 className="type-subheading text-ink">
                    <Link href={`/admin/education/${item.id}`} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
                      {format(text.open, { title: item.title })}
                    </Link>
                  </h2>
                  <p className="flex items-center gap-1.5 text-ink-2">
                    {item.reviewed_on ? <BadgeCheck aria-hidden className="size-4 shrink-0 text-success" /> : null}
                    {item.reviewed_on ? format(text.reviewedOn, { date: formatLongDate(item.reviewed_on) ?? item.reviewed_on }) : text.notReviewed}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <Topics />
    </>
  );
}

function Topics() {
  const categories = useCategories();
  const create = useCreateCategory();
  const busy = useRef(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState(false);
  return (
    <section aria-labelledby="topics-title" className="space-y-4 rounded-card border border-line bg-surface p-5 text-sm shadow-e1 sm:p-6">
      <h2 id="topics-title" className="type-heading text-ink">
        {text.categories}
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-ink" data-topics>
        {(categories.data ?? []).map((item) => (
          <li key={item.id}>{format(messages.education.categoryLine, { name: item.name, count: item.article_count })}</li>
        ))}
      </ul>
      <form
        noValidate
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const address = slug || slugify(name);
          setNotice(false);
          setFailure(null);
          if (name.trim() === "" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(address)) {
            setError(text.errors.slug);
            return;
          }
          setError(null);
          if (busy.current) return;
          busy.current = true;
          create.mutate(
            { slug: address, name: name.trim(), description: description.trim() || null, position: (categories.data?.length ?? 0) + 1 },
            {
              onSuccess: () => {
                busy.current = false;
                setNotice(true);
                setName("");
                setSlug("");
                setDescription("");
              },
              onError: (failed) => {
                busy.current = false;
                setFailure(failed);
              },
            },
          );
        }}
      >
        <h3 className="type-subheading text-ink">{text.newCategory}</h3>
        {(
          [
            ["cat-name", text.categoryName, name, setName],
            ["cat-slug", text.categorySlug, slug, setSlug],
            ["cat-description", text.categoryDescription, description, setDescription],
          ] as const
        ).map(([id, label, value, set]) => (
          <div key={id} className="space-y-1.5">
            <label htmlFor={id} className="block font-medium text-ink">
              {label}
            </label>
            <input id={id} value={value} onChange={(event) => set(event.target.value)} aria-invalid={Boolean(error) && id !== "cat-description"} className="h-11 w-full field-control px-3" />
          </div>
        ))}
        {error ? (
          <p role="alert" className="flex items-center gap-1.5 font-medium text-danger" data-error="category">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" aria-disabled={create.isPending} data-action="add-category">
          {text.categoryAdd}
        </Button>
        {notice ? (
          <p role="status" className="flex items-center gap-2 font-medium text-ink" data-notice>
            <CircleCheck aria-hidden className="size-4 text-success" />
            {text.categoryAdded}
          </p>
        ) : null}
        {failure ? <ApiErrorMessage error={failure} /> : null}
      </form>
    </section>
  );
}
