"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { NotificationCard } from "@/components/notifications/notification-card";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { Pagination } from "@/components/catalogue/pagination";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/errors";
import { pageInfo, parsePageParam } from "@/lib/catalogue/params";
import { useMarkNotification, useNotifications, useUnreadCount } from "@/lib/notifications/hooks";
import { destinationFor, type Filter, parseFilter } from "@/lib/notifications/notifications";
import { format, messages } from "@/messages";

const text = messages.notifications;

const hrefFor = (filter: Filter, page: number) => {
  const params = new URLSearchParams();
  if (filter === "unread") params.set("filter", "unread");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/notifications?${query}` : "/notifications";
};

/** The signed-in person's own notifications, with read and unread controls and a link to each destination. */
export function NotificationsView() {
  const router = useRouter();
  const search = useSearchParams();
  const filter = parseFilter(search.get("filter"));
  const page = parsePageParam(search.get("page") ?? undefined);
  const query = useNotifications(filter, page);
  const unread = useUnreadCount();
  const me = useCurrentUser();
  const mark = useMarkNotification();
  const busy = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const data = query.data;
  const lastPage = data ? pageInfo(data.total, page).page : page;
  useEffect(() => {
    if (data && data.total > 0 && data.items.length === 0 && lastPage !== page) router.replace(hrefFor(filter, lastPage));
  }, [data, lastPage, page, filter, router]);

  const toggle = (id: string, read: boolean) => {
    // A synchronous guard: state updates are too slow to stop a rapid second click.
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setStatus(null);
    mark.mutate(
      { id, read },
      {
        onSuccess: () => {
          busy.current = false;
          setStatus(read ? text.markedRead : text.markedUnread);
        },
        onError: (failure) => {
          busy.current = false;
          if (failure.status === 404) setStatus(text.gone);
          else setError(failure);
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.intro}
        actions={
          unread.data !== undefined ? (
            <p className="inline-flex min-h-8 items-center rounded-full border border-orange-text/30 bg-orange-tint px-3.5 text-sm font-medium text-orange-text" data-unread-count>
              {unread.data > 0 ? format(text.unreadCount, { count: unread.data }) : text.allRead}
            </p>
          ) : null
        }
      />
      <NotificationSettings />
      <nav aria-label={text.filterLabel} className="flex gap-2">
        {(["all", "unread"] as const).map((option) => (
          <Link
            key={option}
            href={hrefFor(option, 1)}
            aria-current={filter === option ? "page" : undefined}
            data-filter={option}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium",
              filter === option ? "border-orange bg-orange text-on-orange" : "border-line bg-paper-2 text-ink hover:bg-orange-tint",
            )}
          >
            {text[option]}
          </Link>
        ))}
      </nav>
      <p ref={statusRef} role="status" className="min-h-6 text-sm font-medium text-ink" data-status>
        {status}
      </p>
      {error ? <ApiErrorMessage error={error} /> : null}
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={
          <EmptyState
            art="inbox"
            title={filter === "unread" ? text.emptyUnreadTitle : text.emptyTitle}
            description={filter === "unread" ? text.emptyUnreadDescription : text.emptyDescription}
          />
        }
      >
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="type-small text-ink-2">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="space-y-3">
                {result.items.map((item) => (
                  <li key={item.id}>
                    <NotificationCard
                      item={item}
                      destination={destinationFor(item, me.data?.memberships ?? [])}
                      working={mark.isPending && mark.variables?.id === item.id}
                      onToggle={toggle}
                    />
                  </li>
                ))}
              </ul>
              <Pagination hrefFor={(target) => hrefFor(filter, target)} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
