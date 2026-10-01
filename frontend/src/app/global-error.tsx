"use client";

import { messages } from "@/messages";

/**
 * Replaces the whole layout when the root layout itself fails, so it must supply its own html
 * and body and cannot rely on the app's styles. Kept deliberately plain.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>{messages.pages.error.title}</h1>
        <p>{messages.pages.error.message}</p>
        <button type="button" onClick={() => retry()}>
          {messages.pages.error.retry}
        </button>
      </body>
    </html>
  );
}
