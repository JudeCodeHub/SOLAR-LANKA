"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";

const api = createBrowserApi();

/** Hand a PDF to the browser as a download without ever exposing a file address. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export const pdfName = (revisionNumber: number) => `quotation-r${revisionNumber}.pdf`;

/** The customer's one export of a revision: ask once, check until the background job has made it, then download. */
export function useRevisionExport(requestId: string, quotationId: string, revisionId: string, revisionNumber: number) {
  const request = useMutation({
    mutationFn: () => unwrap(() => api.POST("/users/me/requests/{request_id}/quotations/{quotation_id}/revisions/{revision_id}/export", { params: { path: { request_id: requestId, quotation_id: quotationId, revision_id: revisionId } } })),
  });
  const exportId = request.data?.id;
  const status = useQuery({
    queryKey: ["quotation-export", exportId],
    enabled: exportId !== undefined,
    queryFn: () => unwrap(() => api.GET("/users/me/exports/{export_id}", { params: { path: { export_id: exportId ?? "" } } })),
    refetchInterval: (query) => (query.state.data?.status === "ready" ? false : 2000),
    staleTime: 0,
  });
  const download = useMutation({
    mutationFn: async () => {
      const blob = (await unwrap(() => api.GET("/users/me/exports/{export_id}/file", { params: { path: { export_id: exportId ?? "" } }, parseAs: "blob" }))) as Blob;
      saveBlob(blob, pdfName(revisionNumber));
    },
  });
  const ready = (status.data?.status ?? request.data?.status) === "ready";
  return { request, status, download, started: exportId !== undefined, ready };
}

/** Company staff fetch the exact revision they sent straight from the stored snapshot. */
export function useCompanyPdf(companyId: string, deliveryId: string, quotationId: string) {
  return useMutation({
    mutationFn: async (input: { revisionId: string; revisionNumber: number }) => {
      const blob = (await unwrap(() => api.GET("/companies/{company_id}/request-deliveries/{delivery_id}/quotations/{quotation_id}/revisions/{revision_id}/pdf", { params: { path: { company_id: companyId, delivery_id: deliveryId, quotation_id: quotationId, revision_id: input.revisionId } }, parseAs: "blob" }))) as Blob;
      saveBlob(blob, pdfName(input.revisionNumber));
    },
  });
}
