import Link from "next/link";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

const text = messages.support.public;

/** The public front door for support: safety first, then what to look up, then who to ask. */
export function PublicSupport() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <section aria-labelledby="safe-title" className="space-y-1 rounded-lg border-2 border-destructive p-3 text-sm">
        <h2 id="safe-title" className="font-semibold">
          {messages.support.safety.title}
        </h2>
        <p>{messages.support.safety.body}</p>
      </section>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>{text.step1}</li>
        <li>{text.step2}</li>
        <li>{text.step3}</li>
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/troubleshooting">{text.lookup}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/my/support">{text.report}</Link>
        </Button>
      </div>
    </div>
  );
}
