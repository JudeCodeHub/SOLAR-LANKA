import { Info } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/lib/navigation";
import { messages } from "@/messages";

const text = messages.footer;

const COLUMNS = [
  { id: "products", title: text.products, items: ["panels", "inverters", "estimator", "companies"] },
  { id: "help", title: text.help, items: ["learn", "troubleshooting", "support"] },
] as const;

/** The footer: the brand, two link columns and the demonstration notice, which every page carries. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-2">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Link href="/" className="inline-flex min-h-11 items-center text-ink" aria-label={messages.app.name}>
            <Logo height={32} />
          </Link>
          <p className="type-body max-w-xs text-ink-2">{messages.brand.tagline}</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.id} aria-labelledby={`footer-${column.id}`}>
            <h2 id={`footer-${column.id}`} className="type-caption font-semibold tracking-widest text-ink-3 uppercase">
              {column.title}
            </h2>
            <ul className="mt-2">
              {column.items.map((id) => {
                const item = NAV_ITEMS.find((candidate) => candidate.id === id);
                return item ? (
                  <li key={id}>
                    <Link href={item.href} className="inline-flex min-h-11 items-center text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                      {item.label}
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="flex items-start gap-3 rounded-panel border border-line bg-surface p-4" data-demo-notice>
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-orange-text" />
          <div className="space-y-1">
            <p className="type-small font-semibold text-ink">{text.noticeTitle}</p>
            <p className="type-small text-ink-2">{text.disclaimer}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
