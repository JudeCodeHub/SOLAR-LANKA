"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useRequestDraft } from "@/lib/requests/draft-store";
import { shouldResetClientState } from "@/lib/session";

/**
 * Notices when the person using the browser changes (sign out, sign in, switched account,
 * or a session that ends in another tab). It then discards every cached API response, so one
 * user's data is never shown to the next, and refreshes the server-rendered parts of the page
 * (such as the header) so they match. Renders nothing.
 */
export function SessionWatcher() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const current = userId ?? null;
    if (shouldResetClientState(previousUserId.current, current)) {
      queryClient.clear();
      // A request being prepared holds what the last person typed; never show it to the next.
      useRequestDraft.getState().clear();
      router.refresh();
    }
    previousUserId.current = current;
  }, [isLoaded, userId, queryClient, router]);

  return null;
}
