import { messages } from "@/messages";

/** The first stop on every page: hidden until focused, then a bold orange pill above the header. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      data-skip-link
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-orange focus:px-5 focus:text-sm focus:font-semibold focus:text-on-orange focus:shadow-e3 focus:outline-3 focus:outline-offset-2 focus:outline-focus"
    >
      {messages.a11y.skipToContent}
    </a>
  );
}
