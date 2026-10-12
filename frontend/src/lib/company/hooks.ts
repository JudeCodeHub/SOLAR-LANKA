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

/** Start a private draft company; the caller becomes its administrator. */
export function useCreateCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["CompanyCreate"]) => unwrap(() => api.POST("/companies", { body })),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}

export type Invite = components["schemas"]["InviteView"];

export function useInvites(companyId: string) {
  return useQuery({
    queryKey: queryKeys.companyInvites(companyId),
    queryFn: () => unwrap(() => api.GET("/companies/{company_id}/invites", { params: { path: { company_id: companyId } } })),
    staleTime: 0,
  });
}

export function useMembers(companyId: string) {
  return useQuery({
    queryKey: queryKeys.companyMembers(companyId),
    queryFn: () => unwrap(() => api.GET("/companies/{company_id}/members", { params: { path: { company_id: companyId } } })),
    staleTime: 0,
  });
}

/** Make a one-time technician code; the code itself comes back only here. */
export function useCreateInvite(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(() => api.POST("/companies/{company_id}/invites", { params: { path: { company_id: companyId } } })),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.companyInvites(companyId) }),
  });
}

export function useRevokeInvite(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      unwrap(() => api.DELETE("/companies/{company_id}/invites/{invite_id}", { params: { path: { company_id: companyId, invite_id: inviteId } } })),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.companyInvites(companyId) }),
  });
}

/** Apply a code the signed-in account was given. */
export function useAcceptInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => unwrap(() => api.POST("/invites/accept", { body: { code } })),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.currentUser }),
  });
}
