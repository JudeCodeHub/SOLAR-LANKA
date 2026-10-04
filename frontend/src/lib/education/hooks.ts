"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

const api = createBrowserApi();

export type ArticleSummary = components["schemas"]["ArticleSummary"];
export type ArticleDetail = components["schemas"]["ArticleDetail"];
export type AdminArticle = components["schemas"]["AdminArticle"];
export type ArticleWrite = components["schemas"]["ArticleWrite"];

export const PAGE_SIZE = 10;
const live = { staleTime: 0, refetchOnWindowFocus: true } as const;

export const useCategories = () => useQuery({ queryKey: ["education", "categories"], queryFn: () => unwrap(() => api.GET("/education/categories")), ...live });

export const useArticles = (search: string, category: string, page: number) =>
  useQuery({
    queryKey: ["education", "articles", search, category, page],
    queryFn: () => unwrap(() => api.GET("/education/articles", { params: { query: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, ...(search ? { search } : {}), ...(category ? { category } : {}) } } })),
    staleTime: 0,
  });

export const useArticle = (slug: string) =>
  useQuery({ queryKey: ["education", "article", slug], queryFn: () => unwrap(() => api.GET("/education/articles/{slug}", { params: { path: { slug } } })), staleTime: 0 });

// ---- administrators ----

const admin = ["education", "admin"] as const;

export const useAdminArticles = (status: string) =>
  useQuery({ queryKey: [...admin, "list", status], queryFn: () => unwrap(() => api.GET("/admin/education/articles", { params: { query: status ? { status } : {} } })), ...live });

export const useAdminArticle = (id: string | null) =>
  useQuery({ queryKey: [...admin, "one", id], queryFn: () => unwrap(() => api.GET("/admin/education/articles/{article_id}", { params: { path: { article_id: id as string } } })), enabled: id !== null, ...live });

export function useEducationActions(id: string | null) {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: ["education"] });
  const path = { article_id: id as string };
  return {
    create: useMutation({ mutationFn: (body: ArticleWrite) => unwrap(() => api.POST("/admin/education/articles", { body })), onSettled: settle }),
    save: useMutation({ mutationFn: (body: ArticleWrite) => unwrap(() => api.PUT("/admin/education/articles/{article_id}", { params: { path }, body })), onSettled: settle }),
    review: useMutation({ mutationFn: () => unwrap(() => api.POST("/admin/education/articles/{article_id}/review", { params: { path } })), onSettled: settle }),
    publish: useMutation({ mutationFn: () => unwrap(() => api.POST("/admin/education/articles/{article_id}/publish", { params: { path } })), onSettled: settle }),
    unpublish: useMutation({ mutationFn: () => unwrap(() => api.POST("/admin/education/articles/{article_id}/unpublish", { params: { path } })), onSettled: settle }),
    archive: useMutation({ mutationFn: () => unwrap(() => api.POST("/admin/education/articles/{article_id}/archive", { params: { path } })), onSettled: settle }),
  };
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { slug: string; name: string; description?: string | null; position: number }) => unwrap(() => api.POST("/admin/education/categories", { body })),
    onSettled: () => client.invalidateQueries({ queryKey: ["education"] }),
  });
}
