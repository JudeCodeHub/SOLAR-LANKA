import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { IconCircle } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import type { Action } from "@/lib/dashboard/dashboard";
import { messages } from "@/messages";

const text = messages.dashboard;

/** The top of the customer's home: a greeting beside a photo of a home in the evening (stacked on phones, so the words never sit on the picture). */
export function HomeHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <header className="grid overflow-hidden rounded-panel border border-line bg-surface shadow-e1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" data-home-header>
      <div className="order-2 flex flex-col justify-center gap-3 p-6 md:order-1 md:p-8">
        <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{eyebrow}</p>
        <h1 className="type-display-m text-ink">{title}</h1>
        <p className="type-body text-ink-2">{intro}</p>
      </div>
      <div className="order-1 md:order-2">
        <Photo name="homeEvening" priority sizes="(min-width: 768px) 45vw, 100vw" className="aspect-[2/1] h-full w-full object-cover md:aspect-auto" />
      </div>
    </header>
  );
}

/** The next steps as large link rows; an empty list says nothing needs attention. */
export function NextSteps({ actions, partial }: { actions: Action[]; partial: boolean }) {
  return (
    <section aria-labelledby="next-title" className="space-y-3" data-next-steps>
      <h2 id="next-title" className="type-heading text-ink">
        {text.nextTitle}
      </h2>
      {actions.length === 0 ? (
        <p className="type-body rounded-card border border-line bg-surface p-4 text-ink-2" data-nothing>
          {text.nothing}
        </p>
      ) : (
        <ul className="space-y-2">
          {actions.map((action) => (
            <li key={action.id}>
              <Link
                href={action.href}
                data-next={action.id}
                className="flex min-h-14 items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-3 font-medium text-ink shadow-e1 transition-shadow hover:bg-orange-tint hover:shadow-e2 motion-reduce:transition-none"
              >
                {action.label}
                <ArrowRight aria-hidden className="size-5 shrink-0 text-orange-text" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {partial ? (
        <p className="type-small text-ink-2" data-partial>
          {text.partial}
        </p>
      ) : null}
    </section>
  );
}

/** One summary card: an icon and heading, the figure when there is one, what is known, and a way in. */
export function SummaryCard({
  id,
  title,
  children,
  link,
  icon,
  figure,
}: {
  id: string;
  title: string;
  children: ReactNode;
  link?: { href: string; label: string };
  icon?: LucideIcon;
  /** The headline number, shown large in the figure face. */
  figure?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 text-sm shadow-e1" data-card={id}>
      <div className="flex items-center gap-3">
        {icon ? <IconCircle icon={icon} /> : null}
        <h2 id={`${id}-title`} className="type-subheading text-ink">
          {title}
        </h2>
      </div>
      {figure !== undefined ? (
        <p className="type-figure text-4xl font-semibold text-ink" data-figure>
          {figure}
        </p>
      ) : null}
      <div className="space-y-1 text-ink-2">{children}</div>
      {link ? (
        <Link href={link.href} className="mt-auto inline-flex min-h-11 items-center gap-1.5 font-medium text-orange-text underline-offset-4 hover:underline">
          {link.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}
