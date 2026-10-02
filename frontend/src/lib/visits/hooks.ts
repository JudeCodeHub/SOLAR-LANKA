"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

const api = createBrowserApi();

export type SiteVisit = components["schemas"]["SiteVisitView"];
export type VisitWork = components["schemas"]["VisitWork"];
export type SlotBody = { starts_at: string; ends_at: string };

const key = {
  mine: (installation: string) => ["visits", "mine", installation] as const,
  staff: (company: string, installation: string) => ["visits", "staff", company, installation] as const,
  work: (company: string, installation: string, visit: string) => ["visits", "work", company, installation, visit] as const,
  technicians: (company: string) => ["visits", "technicians", company] as const,
  list: ["visits", "technician", "list"] as const,
  detail: (id: string) => ["visits", "technician", id] as const,
  outcome: (installation: string, visit: string) => ["visits", "outcome", installation, visit] as const,
};

const live = { staleTime: 0, refetchOnWindowFocus: true } as const;

// ---- customer ----

export function useMyVisits(installation: string) {
  return useQuery({ queryKey: key.mine(installation), queryFn: () => unwrap(() => api.GET("/users/me/installations/{installation_id}/site-visits", { params: { path: { installation_id: installation } } })), ...live });
}

export function useVisitOutcome(installation: string, visit: string, enabled: boolean) {
  return useQuery({
    queryKey: key.outcome(installation, visit),
    queryFn: () => unwrap(() => api.GET("/users/me/installations/{installation_id}/site-visits/{visit_id}/history", { params: { path: { installation_id: installation, visit_id: visit } } })),
    enabled,
    ...live,
  });
}

/** Every customer action re-reads the visits whatever the outcome, so refusals are explained from fresh state. */
export function useCustomerVisitActions(installation: string) {
  const client = useQueryClient();
  const path = (visit: string) => ({ installation_id: installation, visit_id: visit });
  const settle = () => client.invalidateQueries({ queryKey: ["visits"] });
  return {
    request: useMutation({ mutationFn: (body: { slots: SlotBody[]; note?: string | null }) => unwrap(() => api.POST("/users/me/installations/{installation_id}/site-visits", { params: { path: { installation_id: installation } }, body: { ...body, timezone: "Asia/Colombo" } })), onSettled: settle }),
    accept: useMutation({ mutationFn: (input: { visit: string; slot: string }) => unwrap(() => api.POST("/users/me/installations/{installation_id}/site-visits/{visit_id}/accept", { params: { path: path(input.visit) }, body: { slot_id: input.slot } })), onSettled: settle }),
    reschedule: useMutation({ mutationFn: (input: { visit: string; slots: SlotBody[] }) => unwrap(() => api.POST("/users/me/installations/{installation_id}/site-visits/{visit_id}/reschedule", { params: { path: path(input.visit) }, body: { slots: input.slots } })), onSettled: settle }),
    cancel: useMutation({ mutationFn: (visit: string) => unwrap(() => api.POST("/users/me/installations/{installation_id}/site-visits/{visit_id}/cancel", { params: { path: path(visit) }, body: {} })), onSettled: settle }),
  };
}

// ---- company staff ----

export function useStaffVisits(company: string, installation: string) {
  return useQuery({ queryKey: key.staff(company, installation), queryFn: () => unwrap(() => api.GET("/companies/{company_id}/installations/{installation_id}/site-visits", { params: { path: { company_id: company, installation_id: installation } } })), ...live });
}

export function useTechnicians(company: string) {
  return useQuery({ queryKey: key.technicians(company), queryFn: () => unwrap(() => api.GET("/companies/{company_id}/technicians", { params: { path: { company_id: company } } })), ...live });
}

export function useVisitWork(company: string, installation: string, visit: string, enabled: boolean) {
  return useQuery({
    queryKey: key.work(company, installation, visit),
    queryFn: () => unwrap(() => api.GET("/companies/{company_id}/installations/{installation_id}/site-visits/{visit_id}/work", { params: { path: { company_id: company, installation_id: installation, visit_id: visit } } })),
    enabled,
    ...live,
  });
}

export function useStaffVisitActions(company: string, installation: string) {
  const client = useQueryClient();
  const path = (visit: string) => ({ company_id: company, installation_id: installation, visit_id: visit });
  const settle = () => client.invalidateQueries({ queryKey: ["visits"] });
  return {
    confirm: useMutation({ mutationFn: (input: { visit: string; slot: string; technician: string }) => unwrap(() => api.POST("/companies/{company_id}/installations/{installation_id}/site-visits/{visit_id}/confirm", { params: { path: path(input.visit) }, body: { slot_id: input.slot, technician_id: input.technician } })), onSettled: settle }),
    propose: useMutation({ mutationFn: (input: { visit: string; slots: SlotBody[]; technician: string }) => unwrap(() => api.POST("/companies/{company_id}/installations/{installation_id}/site-visits/{visit_id}/propose", { params: { path: path(input.visit) }, body: { slots: input.slots, technician_id: input.technician } })), onSettled: settle }),
    cancel: useMutation({ mutationFn: (visit: string) => unwrap(() => api.POST("/companies/{company_id}/installations/{installation_id}/site-visits/{visit_id}/cancel", { params: { path: path(visit) }, body: {} })), onSettled: settle }),
  };
}

// ---- technician ----

export function useMyAssignedVisits() {
  return useQuery({ queryKey: key.list, queryFn: () => unwrap(() => api.GET("/technician/site-visits")), ...live });
}

export function useAssignedVisit(id: string) {
  return useQuery({ queryKey: key.detail(id), queryFn: () => unwrap(() => api.GET("/technician/site-visits/{visit_id}", { params: { path: { visit_id: id } } })), ...live });
}

export function useTechnicianActions(id: string) {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: ["visits"] });
  return {
    complete: useMutation({ mutationFn: (summary: string) => unwrap(() => api.POST("/technician/site-visits/{visit_id}/complete", { params: { path: { visit_id: id } }, body: { summary } })), onSettled: settle }),
    note: useMutation({ mutationFn: (body: string) => unwrap(() => api.POST("/technician/site-visits/{visit_id}/notes", { params: { path: { visit_id: id } }, body: { body } })), onSettled: settle }),
    upload: useMutation({
      mutationFn: (file: File) => {
        const form = new FormData();
        form.append("file", file);
        return unwrap(() => api.POST("/technician/site-visits/{visit_id}/evidence", { params: { path: { visit_id: id } }, body: { file: "" }, bodySerializer: () => form }));
      },
      onSettled: settle,
    }),
  };
}

/** Fetch one photo through the access-checked route and hand it to the browser as a download. */
export function useDownloadVisitPhoto(path: (asset: string) => Promise<Blob>) {
  return useMutation({
    mutationFn: async (asset: string) => {
      const blob = await path(asset);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "visit-photo";
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

export const technicianPhoto = (visit: string) => async (asset: string) =>
  (await unwrap(() => api.GET("/technician/site-visits/{visit_id}/evidence/{asset_id}", { params: { path: { visit_id: visit, asset_id: asset } }, parseAs: "blob" }))) as Blob;

export const companyPhoto = (company: string, installation: string, visit: string) => async (asset: string) =>
  (await unwrap(() => api.GET("/companies/{company_id}/installations/{installation_id}/site-visits/{visit_id}/evidence/{asset_id}", { params: { path: { company_id: company, installation_id: installation, visit_id: visit, asset_id: asset } }, parseAs: "blob" }))) as Blob;
