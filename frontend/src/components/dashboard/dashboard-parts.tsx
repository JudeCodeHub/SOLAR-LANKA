import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Action } from "@/lib/dashboard/dashboard";
import { messages } from "@/messages";

const text = messages.dashboard;

/** The next steps as links; an empty list says nothing needs attention. */
export function NextSteps({ actions, partial }: { actions: Action[]; partial: boolean }) {
  return (
    <section aria-labelledby="next-title" className="space-y-3" data-next-steps>
      <h2 id="next-title" className="font-heading text-xl font-semibold tracking-tight">
        {text.nextTitle}
      </h2>
      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-nothing>
          {text.nothing}
        </p>
      ) : (
        <ul className="space-y-2">
          {actions.map((action) => (
            <li key={action.id}>
              <Button asChild variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" data-next={action.id}>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {partial ? (
        <p className="text-sm text-muted-foreground" data-partial>
          {text.partial}
        </p>
      ) : null}
    </section>
  );
}

/** One summary card: a heading, what is known, and a way in. */
export function SummaryCard({ id, title, children, link }: { id: string; title: string; children: ReactNode; link?: { href: string; label: string } }) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2 rounded-lg border p-4 text-sm" data-card={id}>
      <h2 id={`${id}-title`} className="font-heading text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children}
      {link ? (
        <Link href={link.href} className="inline-block font-medium underline underline-offset-2">
          {link.label}
        </Link>
      ) : null}
    </section>
  );
}
