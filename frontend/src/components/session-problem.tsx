"use client";

import { AccessNotice } from "@/components/states/access-notice";
import { messages } from "@/messages";

/** What to show when Clerk says the user is signed in but the backend will not serve them. */
export function SessionProblem({
  kind,
  onRetry,
  retrying = false,
}: {
  kind: "inactive" | "rejected";
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const text = messages.session[kind];
  return <AccessNotice kind={kind} title={text.title} description={text.message} onRetry={onRetry} retrying={retrying} />;
}
