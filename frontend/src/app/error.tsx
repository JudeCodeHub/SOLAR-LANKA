"use client";

import { useEffect } from "react";

import { StateScreen } from "@/components/states/state-screen";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/** Last-resort boundary for errors thrown while rendering a page. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The digest links this report to the server log; the message may hold sensitive detail.
    console.error("Page render error", error.digest);
  }, [error]);
  return (
    <StateScreen
      alert
      tone="danger"
      eyebrow={messages.pages.error.eyebrow}
      title={messages.pages.error.title}
      description={messages.pages.error.message}
      actions={<Button onClick={() => retry()}>{messages.pages.error.retry}</Button>}
    />
  );
}
