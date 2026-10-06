"use client";

import type { ReactNode } from "react";

import { QueryState } from "@/components/query-state";
import { AccessNotice } from "@/components/states/access-notice";
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
          <AccessNotice kind="not-allowed" title={messages.admin.notAdmin.title} description={messages.admin.notAdmin.message} />
        )
      }
    </QueryState>
  );
}
