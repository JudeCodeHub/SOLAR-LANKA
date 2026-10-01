"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import type { ApiError } from "@/lib/api/errors";

/**
 * Renders a query in one consistent set of states: loading placeholder, the shared error
 * display with a retry, an empty message, or the data. Pass `isEmpty` to treat some successful
 * results (an empty list) as "nothing here yet", and `empty` to say what to show instead.
 */
export function QueryState<T>({
  query,
  children,
  loading,
  isEmpty,
  empty,
  className,
}: {
  query: UseQueryResult<T, ApiError>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  className?: string;
}) {
  if (query.isPending) {
    return loading ?? <LoadingState className={className} />;
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
  if (isEmpty?.(query.data)) {
    return empty ?? <EmptyState className={className} />;
  }
  return <>{children(query.data)}</>;
}
