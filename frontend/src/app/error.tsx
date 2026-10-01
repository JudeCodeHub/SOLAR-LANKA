"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>{messages.pages.error.title}</AlertTitle>
        <AlertDescription>
          <p>{messages.pages.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => retry()}>
            {messages.pages.error.retry}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
