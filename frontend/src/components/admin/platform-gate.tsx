"use client";

import type { ReactNode } from "react";

import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { useCurrentUser } from "@/lib/api/hooks";
import { messages } from "@/messages";

/** Shows its content only to platform administrators; the backend refuses everyone else independently. */
export function PlatformGate({ children }: { children: (selfId: string) => ReactNode }) {
  const me = useCurrentUser();
  return (
    <QueryState query={me}>
      {(profile) =>
        profile.role === "platform_admin" ? (
          <>{children(profile.id)}</>
        ) : (
          <EmptyState title={messages.admin.notAdmin.title} description={messages.admin.notAdmin.message} />
        )
      }
    </QueryState>
  );
}
