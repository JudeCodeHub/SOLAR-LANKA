"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { Pagination } from "@/components/catalogue/pagination";
import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
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
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
        {unread.data !== undefined ? (
          <p className="text-sm font-medium" data-unread-count>
            {unread.data > 0 ? format(text.unreadCount, { count: unread.data }) : text.allRead}
          </p>
        ) : null}
      </header>
      <NotificationSettings />
      <nav aria-label={text.filterLabel} className="flex gap-2">
        {(["all", "unread"] as const).map((option) => (
          <Button key={option} asChild variant={filter === option ? "default" : "outline"} size="sm">
            <Link href={hrefFor(option, 1)} aria-current={filter === option ? "page" : undefined} data-filter={option}>
              {text[option]}
            </Link>
          </Button>
        ))}
      </nav>
      <p ref={statusRef} role="status" className="min-h-5 text-sm font-medium" data-status>
        {status}
      </p>
      {error ? <ApiErrorMessage error={error} /> : null}
      <QueryState
        query={query}
        isEmpty={(result) => result.total === 0}
        empty={
          <EmptyState
            title={filter === "unread" ? text.emptyUnreadTitle : text.emptyTitle}
            description={filter === "unread" ? text.emptyUnreadDescription : text.emptyDescription}
          />
        }
      >
        {(result) => {
          const info = pageInfo(result.total, page);
          return (
            <section aria-label={text.title} className="space-y-4">
              <p className="text-sm text-muted-foreground">{format(text.showing, { from: info.from, to: info.to, total: result.total })}</p>
              <ul className="space-y-3">
                {result.items.map((item) => {
                  const unreadItem = item.read_at === null;
                  const destination = destinationFor(item, me.data?.memberships ?? []);
                  const working = mark.isPending && mark.variables?.id === item.id;
                  return (
                    <li key={item.id} className="space-y-2 rounded-lg border p-4 text-sm" data-notification={unreadItem ? "unread" : "read"}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={unreadItem ? "text-base font-semibold" : "text-base font-medium"}>{item.title}</h2>
                        <span className="rounded-full border px-2 py-0.5 text-xs" data-badge={unreadItem ? "unread" : "read"}>
                          {unreadItem ? text.unreadBadge : text.readBadge}
                        </span>
                      </div>
                      <p>{item.body}</p>
                      <p className="text-muted-foreground">{format(text.received, { date: formatLongDate(item.created_at) ?? item.created_at })}</p>
                      <div className="flex flex-wrap gap-2">
                        {destination ? (
                          <Button asChild size="sm">
                            <Link href={destination.href}>{destination.label}</Link>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-disabled={mark.isPending}
                          data-action={unreadItem ? "mark-read" : "mark-unread"}
                          onClick={() => toggle(item.id, unreadItem)}
                        >
                          {working ? text.working : unreadItem ? text.markRead : text.markUnread}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Pagination hrefFor={(target) => hrefFor(filter, target)} page={info.page} pageCount={info.pageCount} />
            </section>
          );
        }}
      </QueryState>
    </div>
  );
}
