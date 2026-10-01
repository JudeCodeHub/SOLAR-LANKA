"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";

const api = createBrowserApi();

export const INBOX_PAGE_SIZE = 12;
export const NOTES_LIMIT = 50;

/** One page of enquiries addressed to the company, newest first. Only its own staff are answered. */
export function useInbox(companyId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.inbox(companyId, page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/request-deliveries", {
          params: {
            path: { company_id: companyId },
            query: { limit: INBOX_PAGE_SIZE, offset: (page - 1) * INBOX_PAGE_SIZE },
          },
        }),
      ),
    staleTime: 0,
  });
}

/** One enquiry. Always asked for again on return and on window focus, because customers can withdraw it. */
export function useEnquiry(companyId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.enquiry(companyId, id),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/request-deliveries/{delivery_id}", {
          params: { path: { company_id: companyId, delivery_id: id } },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** The internal notes on one enquiry, newest first. */
export function useNotes(companyId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.enquiryNotes(companyId, id),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/request-deliveries/{delivery_id}/notes", {
          params: { path: { company_id: companyId, delivery_id: id }, query: { limit: NOTES_LIMIT, offset: 0 } },
        }),
      ),
    staleTime: 0,
  });
}

function useRefresh(companyId: string, id: string) {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: queryKeys.enquiry(companyId, id) });
    await client.invalidateQueries({ queryKey: queryKeys.inboxAll(companyId) });
  };
}

/** Mark an enquiry as opened or as being responded to; the customer sees this on their request. */
export function useMarkProgress(companyId: string, id: string) {
  const refresh = useRefresh(companyId, id);
  return useMutation({
    mutationFn: (status: "viewed" | "responding") =>
      unwrap(() =>
        api.PATCH("/companies/{company_id}/request-deliveries/{delivery_id}/progress", {
          params: { path: { company_id: companyId, delivery_id: id } },
          body: { status },
        }),
      ),
    onSettled: refresh,
  });
}

export function useCloseEnquiry(companyId: string, id: string) {
  const refresh = useRefresh(companyId, id);
  return useMutation({
    mutationFn: () =>
      unwrap(() =>
        api.POST("/companies/{company_id}/request-deliveries/{delivery_id}/close", {
          params: { path: { company_id: companyId, delivery_id: id } },
        }),
      ),
    onSettled: refresh,
  });
}

/** Add an internal note; the backend never shows notes to customers. */
export function useAddNote(companyId: string, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(() =>
        api.POST("/companies/{company_id}/request-deliveries/{delivery_id}/notes", {
          params: { path: { company_id: companyId, delivery_id: id } },
          body: { body },
        }),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.enquiryNotes(companyId, id) }),
  });
}
