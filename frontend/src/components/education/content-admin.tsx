"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { slugify, statusLabel } from "@/lib/education/education";
import { useAdminArticles, useCategories, useCreateCategory } from "@/lib/education/hooks";
import { format, messages } from "@/messages";

const text = messages.adminEducation;

/** All learning content for platform administrators, with topics. */
export function ContentAdmin() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <PlatformGate>{() => <Body />}</PlatformGate>
    </div>
  );
}

function Body() {
  const [status, setStatus] = useState("");
  const query = useAdminArticles(status);
  return (
    <>
      <Button asChild>
        <Link href="/admin/education/new">{text.newArticle}</Link>
      </Button>
      <div className="space-y-1">
        <label htmlFor="status" className="block font-medium">
          {text.filter}
        </label>
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 field-control field-select px-2">
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
          <ul className="space-y-2" data-admin-articles>
            {items.map((item) => (
              <li key={item.id} className="space-y-1 rounded-lg border p-3 text-sm" data-status={item.status}>
                <h2 className="text-base font-semibold">
                  <Link href={`/admin/education/${item.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                    {format(text.open, { title: item.title })}
                  </Link>
                </h2>
                <p className="text-muted-foreground">{statusLabel(item.status)}</p>
                <p className="text-muted-foreground">{item.reviewed_on ? format(text.reviewedOn, { date: formatLongDate(item.reviewed_on) ?? item.reviewed_on }) : text.notReviewed}</p>
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
    <section aria-labelledby="topics-title" className="space-y-3 text-sm">
      <h2 id="topics-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.categories}
      </h2>
      <ul className="list-disc pl-5" data-topics>
        {(categories.data ?? []).map((item) => (
          <li key={item.id}>{format(messages.education.categoryLine, { name: item.name, count: item.article_count })}</li>
        ))}
      </ul>
      <form
        noValidate
        className="space-y-2"
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
        <h3 className="font-medium">{text.newCategory}</h3>
        {(
          [
            ["cat-name", text.categoryName, name, setName],
            ["cat-slug", text.categorySlug, slug, setSlug],
            ["cat-description", text.categoryDescription, description, setDescription],
          ] as const
        ).map(([id, label, value, set]) => (
          <div key={id} className="space-y-1">
            <label htmlFor={id} className="block font-medium">
              {label}
            </label>
            <input id={id} value={value} onChange={(event) => set(event.target.value)} aria-invalid={Boolean(error) && id !== "cat-description"} className="h-11 w-full field-control px-3" />
          </div>
        ))}
        {error ? (
          <p role="alert" className="font-medium text-destructive" data-error="category">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" aria-disabled={create.isPending} data-action="add-category">
          {text.categoryAdd}
        </Button>
        {notice ? (
          <p role="status" className="font-medium" data-notice>
            {text.categoryAdded}
          </p>
        ) : null}
        {failure ? <ApiErrorMessage error={failure} /> : null}
      </form>
    </section>
  );
}
