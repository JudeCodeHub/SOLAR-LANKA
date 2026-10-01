"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";

import { type Filter, NOTIFICATIONS_PAGE_SIZE } from "./notifications";

const api = createBrowserApi();

/** One page of the signed-in person's own notifications, newest first. */
export function useNotifications(filter: Filter, page: number) {
  return useQuery({
    queryKey: queryKeys.notificationList(filter, page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/users/me/notifications", {
          params: { query: { limit: NOTIFICATIONS_PAGE_SIZE, offset: (page - 1) * NOTIFICATIONS_PAGE_SIZE, unread_only: filter === "unread" } },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** How many are unread, from a one-item page so only the total is needed. */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notificationUnread,
    queryFn: async () => (await unwrap(() => api.GET("/users/me/notifications", { params: { query: { limit: 1, offset: 0, unread_only: true } } }))).total,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Mark one notification read or unread; every list and the count are read again whatever the outcome. */
export function useMarkNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; read: boolean }) =>
      unwrap(() =>
        input.read
          ? api.PUT("/users/me/notifications/{notification_id}/read", { params: { path: { notification_id: input.id } } })
          : api.PUT("/users/me/notifications/{notification_id}/unread", { params: { path: { notification_id: input.id } } }),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  });
}
