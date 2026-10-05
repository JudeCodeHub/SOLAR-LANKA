"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";
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
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
      <ErrorState
        title={messages.pages.error.title}
        description={messages.pages.error.message}
        action={
          <Button variant="outline" onClick={() => retry()}>
            {messages.pages.error.retry}
          </Button>
        }
      />
    </div>
  );
}
