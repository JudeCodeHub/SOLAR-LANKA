"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "@/lib/query/keys";

const api = createBrowserApi();

export const COMPANY_INSTALLATIONS_PAGE_SIZE = 12;

export type MilestoneMove = components["schemas"]["MilestoneTransition"];

/** One page of the company's installations, newest first. Only its own staff are answered. */
export function useCompanyInstallations(companyId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.companyInstallationList(companyId, page),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/installations", {
          params: {
            path: { company_id: companyId },
            query: { limit: COMPANY_INSTALLATIONS_PAGE_SIZE, offset: (page - 1) * COMPANY_INSTALLATIONS_PAGE_SIZE },
          },
        }),
      ),
    staleTime: 0,
  });
}

/** One installation with its steps and history, always read again on return and on window focus. */
export function useCompanyInstallation(companyId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.companyInstallation(companyId, id),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/installations/{installation_id}", {
          params: { path: { company_id: companyId, installation_id: id } },
        }),
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Move one step. Whatever the outcome the installation is read again, so refusals are explained from fresh state. */
export function useMoveMilestone(companyId: string, installationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { milestoneId: string; body: MilestoneMove }) =>
      unwrap(() =>
        api.PUT("/companies/{company_id}/installations/{installation_id}/milestones/{milestone_id}", {
          params: { path: { company_id: companyId, installation_id: installationId, milestone_id: input.milestoneId } },
          body: input.body,
        }),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.companyInstallation(companyId, installationId) }),
  });
}
