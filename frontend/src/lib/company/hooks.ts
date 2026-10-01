"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import type { ProfileUpdate } from "@/lib/company/profile";
import { queryKeys } from "@/lib/query/keys";

const api = createBrowserApi();

export type CompanyProfile = components["schemas"]["CompanyProfileResponse"];

/** The company's private profile. Only its own staff are answered; everyone else gets 403. */
export function useCompanyProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.companyProfile(id),
    queryFn: () => unwrap(() => api.GET("/companies/{company_id}", { params: { path: { company_id: id } } })),
    // The status can change while someone is editing (a reviewer decides), so look again on return.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export const REVIEWS_LIMIT = 20;

export function useCompanyReviews(id: string) {
  return useQuery({
    queryKey: queryKeys.companyReviews(id),
    queryFn: () =>
      unwrap(() =>
        api.GET("/companies/{company_id}/reviews", {
          params: { path: { company_id: id }, query: { limit: REVIEWS_LIMIT, offset: 0 } },
        }),
      ),
    staleTime: 0,
  });
}

/** Save profile changes. Only the fields that changed are sent. */
export function useUpdateProfile(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ declared_credentials, ...rest }: ProfileUpdate) =>
      unwrap(() =>
        api.PATCH("/companies/{company_id}", {
          params: { path: { company_id: id } },
          body: {
            ...rest,
            // Credentials are always the company's own claim; the platform never marks one verified.
            ...(declared_credentials
              ? { declared_credentials: declared_credentials.map((entry) => ({ ...entry, verification_status: "company_declared" as const })) }
              : {}),
          },
        }),
      ),
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.companyProfile(id), profile);
      void client.invalidateQueries({ queryKey: queryKeys.companyReviews(id) });
    },
  });
}

/** Submit the profile for platform review. */
export function useSubmitProfile(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(() => api.POST("/companies/{company_id}/submit", { params: { path: { company_id: id } } })),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.companyProfile(id) });
      await client.invalidateQueries({ queryKey: queryKeys.companyReviews(id) });
    },
  });
}
