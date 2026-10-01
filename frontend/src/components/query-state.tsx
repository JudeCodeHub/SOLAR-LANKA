"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api/errors";

/**
 * Renders a query in one of three consistent states: loading placeholder, the shared error
 * display with a retry, or the data. Empty-data presentation is added with the shared
 * empty-state convention (13.09).
 */
export function QueryState<T>({
  query,
  children,
  loading,
  className,
}: {
  query: UseQueryResult<T, ApiError>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  className?: string;
}) {
  if (query.isPending) {
    return (
      loading ?? (
        <div role="status" aria-busy="true" className={className}>
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-16 w-full" />
        </div>
      )
    );
  }
  if (query.isError) {
    return (
      <ApiErrorMessage
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
        className={className}
      />
    );
  }
  return <>{children(query.data)}</>;
}
