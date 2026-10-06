import { OctagonAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Photo } from "@/components/ui/photo";
import { messages } from "@/messages";

const text = messages.support.public;

/** The public front door for support: safety first, then what to look up, then who to ask. */
export function PublicSupport() {
  const steps = [text.step1, text.step2, text.step3];
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section aria-labelledby="safe-title" className="flex flex-col gap-3 rounded-card border-2 border-danger bg-danger-tint p-6" data-safety-first>
          <OctagonAlert aria-hidden className="size-8 text-danger" />
          <h2 id="safe-title" className="type-heading text-ink">
            {messages.support.safety.title}
          </h2>
          <p className="type-body text-ink">{messages.support.safety.body}</p>
        </section>
        <div aria-hidden className="overflow-hidden rounded-card border border-line bg-paper-2">
          <Photo name="safetyVisit" sizes="(min-width: 1024px) 352px, 100vw" className="aspect-[16/10] h-full w-full object-cover" />
        </div>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3" data-steps>
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-e1">
            <span aria-hidden className="type-figure text-3xl font-semibold text-orange-text">
              {index + 1}
            </span>
            <p className="type-body text-ink">{step}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/troubleshooting">{text.lookup}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/my/support">{text.report}</Link>
        </Button>
      </div>
    </div>
  );
}
