"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

const api = createBrowserApi();

export type Lookup = components["schemas"]["Lookup"];
export type SupportCase = components["schemas"]["SupportCaseView"];
export type CaseUpdate = components["schemas"]["UpdateView"];
export type AssignedCase = components["schemas"]["AssignedCase"];
export type AdminReference = components["schemas"]["AdminReferenceView"];
export type ReferenceWrite = components["schemas"]["ReferenceWrite"];

const live = { staleTime: 0, refetchOnWindowFocus: true } as const;
const all = ["support"] as const;

// ---- troubleshooting (public) ----

/** One exact-model lookup, asked only when a query exists. */
export function useLookup(query: Record<string, string> | null) {
  return useQuery({
    queryKey: ["support", "lookup", query],
    queryFn: () => unwrap(() => api.GET("/troubleshooting", { params: { query: query as { model?: string; product_id?: string; code?: string } } })),
    enabled: query !== null,
    staleTime: 0,
  });
}

// ---- customer ----

export const useMyCases = () => useQuery({ queryKey: [...all, "mine"], queryFn: () => unwrap(() => api.GET("/users/me/support-cases")), ...live });

export const useMyCase = (id: string) =>
  useQuery({ queryKey: [...all, "mine", id], queryFn: () => unwrap(() => api.GET("/users/me/support-cases/{case_id}", { params: { path: { case_id: id } } })), ...live });

export const useMyUpdates = (id: string) =>
  useQuery({ queryKey: [...all, "mine", id, "updates"], queryFn: () => unwrap(() => api.GET("/users/me/support-cases/{case_id}/updates", { params: { path: { case_id: id } } })), ...live });

export const useMyInstallations = () =>
  useQuery({ queryKey: ["support", "installations"], queryFn: () => unwrap(() => api.GET("/users/me/installations", { params: { query: { limit: 50, offset: 0 } } })), ...live });

export function useCustomerSupport(id: string) {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: all });
  const path = { case_id: id };
  return {
    message: useMutation({ mutationFn: (input: { body: string; key: string }) => unwrap(() => api.POST("/users/me/support-cases/{case_id}/updates", { params: { path }, body: { body: input.body, shared: true }, headers: { "Idempotency-Key": input.key } })), onSettled: settle }),
    status: useMutation({ mutationFn: (input: { to: "open" | "closed"; body?: string; key: string }) => unwrap(() => api.POST("/users/me/support-cases/{case_id}/status", { params: { path }, body: { to: input.to, body: input.body || null }, headers: { "Idempotency-Key": input.key } })), onSettled: settle }),
    upload: useMutation({
      mutationFn: (file: File) => {
        const form = new FormData();
        form.append("file", file);
        return unwrap(() => api.POST("/users/me/support-cases/{case_id}/attachments", { params: { path }, body: { file: "" }, bodySerializer: () => form }));
      },
      onSettled: settle,
    }),
  };
}

export function useOpenCase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { installation_id: string; product_id?: string | null; symptom: string; observed_code?: string | null; unsafe_now: boolean }) => unwrap(() => api.POST("/users/me/support-cases", { body })),
    onSettled: () => client.invalidateQueries({ queryKey: all }),
  });
}

export const customerPhoto = (id: string) => async (asset: string) =>
  (await unwrap(() => api.GET("/users/me/support-cases/{case_id}/attachments/{asset_id}", { params: { path: { case_id: id, asset_id: asset } }, parseAs: "blob" }))) as Blob;

// ---- company ----

export const useCompanyCases = (company: string) =>
  useQuery({ queryKey: [...all, "company", company], queryFn: () => unwrap(() => api.GET("/companies/{company_id}/support-cases", { params: { path: { company_id: company } } })), ...live });

export const useCompanyCase = (company: string, id: string) =>
  useQuery({ queryKey: [...all, "company", company, id], queryFn: () => unwrap(() => api.GET("/companies/{company_id}/support-cases/{case_id}", { params: { path: { company_id: company, case_id: id } } })), ...live });

export const useCompanyUpdates = (company: string, id: string) =>
  useQuery({ queryKey: [...all, "company", company, id, "updates"], queryFn: () => unwrap(() => api.GET("/companies/{company_id}/support-cases/{case_id}/updates", { params: { path: { company_id: company, case_id: id } } })), ...live });

export const useCaseAssignments = (company: string, id: string) =>
  useQuery({ queryKey: [...all, "company", company, id, "assignments"], queryFn: () => unwrap(() => api.GET("/companies/{company_id}/support-cases/{case_id}/assignments", { params: { path: { company_id: company, case_id: id } } })), ...live });

export function useCompanySupport(company: string, id: string) {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: all });
  const path = { company_id: company, case_id: id };
  return {
    update: useMutation({ mutationFn: (input: { body: string; shared: boolean; key: string }) => unwrap(() => api.POST("/companies/{company_id}/support-cases/{case_id}/updates", { params: { path }, body: { body: input.body, shared: input.shared }, headers: { "Idempotency-Key": input.key } })), onSettled: settle }),
    status: useMutation({ mutationFn: (input: { to: "open" | "in_progress" | "resolved" | "closed"; body?: string; key: string }) => unwrap(() => api.POST("/companies/{company_id}/support-cases/{case_id}/status", { params: { path }, body: { to: input.to, body: input.body || null }, headers: { "Idempotency-Key": input.key } })), onSettled: settle }),
    assign: useMutation({ mutationFn: (input: { user: string; key: string }) => unwrap(() => api.POST("/companies/{company_id}/support-cases/{case_id}/assignments", { params: { path }, body: { user_id: input.user }, headers: { "Idempotency-Key": input.key } })), onSettled: settle }),
    unassign: useMutation({ mutationFn: (user: string) => unwrap(() => api.DELETE("/companies/{company_id}/support-cases/{case_id}/assignments/{technician_id}", { params: { path: { ...path, technician_id: user } } })), onSettled: settle }),
  };
}

export const companyPhoto = (company: string, id: string) => async (asset: string) =>
  (await unwrap(() => api.GET("/companies/{company_id}/support-cases/{case_id}/attachments/{asset_id}", { params: { path: { company_id: company, case_id: id, asset_id: asset } }, parseAs: "blob" }))) as Blob;

// ---- technician ----

export const useAssignedCases = () => useQuery({ queryKey: [...all, "technician"], queryFn: () => unwrap(() => api.GET("/technician/support-cases")), ...live });

export const useAssignedCase = (id: string) =>
  useQuery({ queryKey: [...all, "technician", id], queryFn: () => unwrap(() => api.GET("/technician/support-cases/{case_id}", { params: { path: { case_id: id } } })), ...live });

export function useTechnicianSupport(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; shared: boolean; key: string }) => unwrap(() => api.POST("/technician/support-cases/{case_id}/updates", { params: { path: { case_id: id } }, body: { body: input.body, shared: input.shared }, headers: { "Idempotency-Key": input.key } })),
    onSettled: () => client.invalidateQueries({ queryKey: all }),
  });
}

export const technicianPhoto = (id: string) => async (asset: string) =>
  (await unwrap(() => api.GET("/technician/support-cases/{case_id}/attachments/{asset_id}", { params: { path: { case_id: id, asset_id: asset } }, parseAs: "blob" }))) as Blob;

/** Fetch one photo through its access-checked route and hand it to the browser as a download. */
export function useDownloadPhoto(fetchPhoto: (asset: string) => Promise<Blob>) {
  return useMutation({
    mutationFn: async (asset: string) => {
      const url = URL.createObjectURL(await fetchPhoto(asset));
      const link = document.createElement("a");
      link.href = url;
      link.download = "support-photo";
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

// ---- platform administrators: troubleshooting references ----

export const useReferences = () => useQuery({ queryKey: [...all, "admin", "references"], queryFn: () => unwrap(() => api.GET("/admin/troubleshooting")), ...live });

export function useReferenceActions() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: all });
  return {
    create: useMutation({ mutationFn: (body: ReferenceWrite) => unwrap(() => api.POST("/admin/troubleshooting", { body })), onSettled: settle }),
    publish: useMutation({ mutationFn: (id: string) => unwrap(() => api.POST("/admin/troubleshooting/{reference_id}/publish", { params: { path: { reference_id: id } } })), onSettled: settle }),
    archive: useMutation({ mutationFn: (id: string) => unwrap(() => api.POST("/admin/troubleshooting/{reference_id}/archive", { params: { path: { reference_id: id } } })), onSettled: settle }),
  };
}

/** Resolve a typed model name to exactly one product, for authoring. */
export async function resolveModel(model: string): Promise<Lookup> {
  return unwrap(() => api.GET("/troubleshooting", { params: { query: { model } } }));
}
