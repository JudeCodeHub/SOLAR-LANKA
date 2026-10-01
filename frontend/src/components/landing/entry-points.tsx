import Link from "next/link";

import { type EntryPoint, publicEntryPoints } from "@/lib/navigation";
import { messages } from "@/messages";

const cardClass = "flex h-full flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground";

function Entry({ entry }: { entry: EntryPoint }) {
  const descriptions: Record<string, string> = messages.landing.entry.descriptions;
  const body = (
    <>
      <span className="font-medium">{entry.label}</span>
      <span className="text-sm text-muted-foreground">{descriptions[entry.id]}</span>
    </>
  );
  if (entry.linkable) {
    return (
      <Link
        href={entry.href}
        className={`${cardClass} outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50`}
      >
        {body}
      </Link>
    );
  }
  // Not built yet: shown so visitors see what is planned, but never a link.
  return (
    <div className={`${cardClass} opacity-80`}>
      {body}
      <span className="mt-1 w-fit rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
        {messages.landing.entry.comingSoon}
      </span>
    </div>
  );
}

/** The ways into the application. A destination links only once its page exists. */
export function EntryPoints() {
  return (
    <section aria-labelledby="entry-points-title" className="space-y-4">
      <h2 id="entry-points-title" className="font-heading text-2xl font-semibold tracking-tight">
        {messages.landing.entry.title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {publicEntryPoints().map((entry) => (
          <li key={entry.id}>
            <Entry entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
