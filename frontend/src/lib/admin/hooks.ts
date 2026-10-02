"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";

import { QUEUE_PAGE_SIZE } from "./review";

const api = createBrowserApi();

/** One page of companies waiting for review, oldest first; one extra is asked for to know whether there is a next page. */
export function usePendingCompanies(page: number) {
  return useQuery({
    queryKey: queryKeys.adminPending(page),
    queryFn: () =>
      unwrap(() => api.GET("/admin/companies/pending", { params: { query: { limit: QUEUE_PAGE_SIZE + 1, offset: (page - 1) * QUEUE_PAGE_SIZE } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useAdminCompany(id: string) {
  return useQuery({
    queryKey: queryKeys.adminCompany(id),
    queryFn: () => unwrap(() => api.GET("/admin/companies/{company_id}", { params: { path: { company_id: id } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useAdminReviews(id: string) {
  return useQuery({
    queryKey: queryKeys.adminReviews(id),
    queryFn: () => unwrap(() => api.GET("/admin/companies/{company_id}/reviews", { params: { path: { company_id: id }, query: { limit: 50, offset: 0 } } })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Decide a pending company; the company, its history and the queue are read again whatever the outcome. */
export function useDecide(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (outcome: "approved" | "rejected") =>
      unwrap(() => api.POST("/companies/{company_id}/review", { params: { path: { company_id: id } }, body: { outcome } })),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.adminCompany(id) }),
        client.invalidateQueries({ queryKey: queryKeys.adminReviews(id) }),
        client.invalidateQueries({ queryKey: queryKeys.adminPendingAll }),
      ]),
  });
}

/** Suspend or restore one account. */
export function useSetAccountStatus() {
  return useMutation({
    mutationFn: (input: { id: string; suspended: boolean }) =>
      unwrap(() => api.PATCH("/admin/users/{user_id}/status", { params: { path: { user_id: input.id } }, body: { is_suspended: input.suspended } })),
  });
}
