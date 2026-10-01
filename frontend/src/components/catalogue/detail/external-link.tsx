import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { messages } from "@/messages";

/**
 * A link to another site. It opens in a new tab, says so for screen readers, and does not pass
 * this site's address on (noopener noreferrer). Only addresses already checked by
 * safeExternalUrl should be given to it.
 */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
      <ExternalLinkIcon aria-hidden className="size-3.5" />
      <span className="sr-only">{messages.detail.documents.opensNewTab}</span>
    </a>
  );
}
