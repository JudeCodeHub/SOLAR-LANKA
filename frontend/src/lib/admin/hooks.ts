"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
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

export function useActivity() {
  return useQuery({
    queryKey: queryKeys.adminActivity,
    queryFn: () => unwrap(() => api.GET("/admin/activity")),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** One page of the audit log, newest first; one extra entry is asked for to know whether there is a next page. */
export function useAuditEvents(company: string, page: number, size: number) {
  return useQuery({
    queryKey: queryKeys.adminAudit(company, page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/audit-events", { params: { query: { limit: size + 1, offset: (page - 1) * size, ...(company ? { company_id: company } : {}) } } }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export const PRODUCTS_PAGE_SIZE = 12;

export function useAdminProducts(kind: "panel" | "inverter", search: string, page: number) {
  const query = { limit: PRODUCTS_PAGE_SIZE, offset: (page - 1) * PRODUCTS_PAGE_SIZE, ...(search ? { search } : {}) };
  return useQuery({
    queryKey: queryKeys.adminProducts(kind, search, page),
    queryFn: () => unwrap(() => (kind === "panel" ? api.GET("/catalogue/panels", { params: { query } }) : api.GET("/catalogue/inverters", { params: { query } }))),
    staleTime: 0,
  });
}

/** One product with its stored specifications; an archived or unknown product is null. */
export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.adminProduct(id),
    queryFn: async () => {
      for (const kind of ["panel", "inverter"] as const) {
        try {
          return await unwrap(() =>
            kind === "panel" ? api.GET("/catalogue/panels/{product_id}", { params: { path: { product_id: id } } }) : api.GET("/catalogue/inverters/{product_id}", { params: { path: { product_id: id } } }),
          );
        } catch (error) {
          if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 422)) throw error;
        }
      }
      return null;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Save name and specification changes in one go; only the parts with changes are sent. */
export function useEditProduct(id: string, kind: "panel" | "inverter") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { names: Record<string, string>; specs: Record<string, string | number | null> }) => {
      if (Object.keys(input.names).length > 0) {
        await unwrap(() => api.PATCH("/admin/products/{product_id}", { params: { path: { product_id: id } }, body: input.names }));
      }
      if (Object.keys(input.specs).length > 0) {
        await unwrap(() =>
          kind === "panel"
            ? api.PATCH("/admin/products/{product_id}/panel", { params: { path: { product_id: id } }, body: input.specs })
            : api.PATCH("/admin/products/{product_id}/inverter", { params: { path: { product_id: id } }, body: input.specs as never }),
        );
      }
    },
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.adminProduct(id) }), client.invalidateQueries({ queryKey: queryKeys.adminProductsAll })]),
  });
}

export function useArchiveProduct(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(() => api.POST("/admin/products/{product_id}/archive", { params: { path: { product_id: id } } })),
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.adminProduct(id) }), client.invalidateQueries({ queryKey: queryKeys.adminProductsAll })]),
  });
}

export function useConfigVersions() {
  return useQuery({
    queryKey: queryKeys.adminConfigs,
    queryFn: () => unwrap(() => api.GET("/admin/estimator-configs")),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useConfigVersion(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminConfig(id ?? "none"),
    queryFn: () => unwrap(() => api.GET("/admin/estimator-configs/{version_id}", { params: { path: { version_id: id as string } } })),
    enabled: id !== null,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Every config change re-reads the list and the version, whatever the outcome, so refusals are explained from fresh state. */
export function useConfigActions(id: string | null) {
  const client = useQueryClient();
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.adminConfigs }), id ? client.invalidateQueries({ queryKey: queryKeys.adminConfig(id) }) : Promise.resolve()]);
  return {
    create: useMutation({ mutationFn: (body: DraftBodyInput) => unwrap(() => api.POST("/admin/estimator-configs/drafts", { body: body as never })), onSettled: refresh }),
    save: useMutation({
      mutationFn: (body: DraftBodyInput) => unwrap(() => api.PUT("/admin/estimator-configs/drafts/{version_id}", { params: { path: { version_id: id as string } }, body: body as never })),
      onSettled: refresh,
    }),
    publish: useMutation({ mutationFn: () => unwrap(() => api.POST("/admin/estimator-configs/drafts/{version_id}/publish", { params: { path: { version_id: id as string } } })), onSettled: refresh }),
    archive: useMutation({ mutationFn: () => unwrap(() => api.POST("/admin/estimator-configs/{version_id}/archive", { params: { path: { version_id: id as string } } })), onSettled: refresh }),
  };
}

type DraftBodyInput = { scenario: string; assumptions: Record<string, unknown>; source_metadata: Record<string, unknown> };
