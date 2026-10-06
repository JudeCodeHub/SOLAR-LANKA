import { Lock, MessageSquareText, Send, Tag, Undo2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/catalogue/detail";
import { headline, requestChip, type RequestLike } from "@/lib/requests/progress";
import { format, messages, plural } from "@/messages";

const text = messages.requests.list;
const CHIP_ICONS = { sent: Send, responding: MessageSquareText, closed: Lock, withdrawn: Undo2, other: Tag } as const;

/** One sent request: its state as a chip, when it was sent, how many companies it went to and where it stands; the whole card opens it. */
export function RequestCard({ item }: { item: RequestLike & { id: string; created_at: string } }) {
  const chip = requestChip(item);
  return (
    <article data-request={chip.state} className="relative flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-e1 transition-shadow hover:shadow-e2 motion-reduce:transition-none">
      <Badge variant={chip.tone} icon={CHIP_ICONS[chip.state]} data-chip={chip.state} className="w-fit">
        {chip.label}
      </Badge>
      <h2 className="type-subheading text-ink">
        <Link
          href={`/my/requests/${item.id}`}
          className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text"
        >
          {format(text.sentOn, { date: formatLongDate(item.created_at) ?? item.created_at })}
        </Link>
      </h2>
      <p className="type-small text-ink-2">{format(plural(text.companies, item.deliveries.length), { count: item.deliveries.length })}</p>
      <p className="type-body text-ink">{headline(item)}</p>
    </article>
  );
}
