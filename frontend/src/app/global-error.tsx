"use client";

import { messages } from "@/messages";

/** The root layout, and so the stylesheet, is gone here, so this page carries its own small styles in the brand colours. */
const STYLES = `
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem 1rem; text-align: center; background: #FBF8F3; color: #1A1511; font-family: system-ui, sans-serif; }
  h1 { font-family: Georgia, serif; font-size: 2rem; margin: 0 0 0.75rem; }
  p { margin: 0 0 1.5rem; max-width: 28rem; line-height: 1.5; color: #4B4036; }
  button { min-height: 44px; padding: 0 1.5rem; border: 0; border-radius: 999px; background: #FF6A1A; color: #1A1511; font: inherit; font-weight: 600; cursor: pointer; }
  button:focus-visible { outline: 3px solid #1A1511; outline-offset: 3px; }
  @media (prefers-color-scheme: dark) { body { background: #0D0B09; color: #F7F0E7; } p { color: #CDBFB0; } button:focus-visible { outline-color: #F7F0E7; } }
`;

/** Replaces the whole layout when the root layout itself fails. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <style>{STYLES}</style>
        <main role="alert">
          <h1>{messages.pages.error.title}</h1>
          <p>{messages.pages.error.message}</p>
          <button type="button" onClick={() => retry()}>
            {messages.pages.error.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
