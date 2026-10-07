import { Eye, Lock, MailPlus, MessageSquareText, Tag, Undo2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/catalogue/detail";
import { companyStatusLabel, enquiryTone } from "@/lib/inbox/inbox";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.company.inbox;
const ICONS = { submitted: MailPlus, viewed: Eye, responding: MessageSquareText, closed: Lock, cancelled: Undo2 } as const;

/** One enquiry: its status as a chip (a new one also has a bar and a tint), the day it arrived as a 44 px link over the whole card, and the district. */
export function EnquiryCard({ item, href }: { item: { id: string; status: string; created_at: string; district: string }; href: string }) {
  const isNew = item.status === "submitted";
  const Icon = (ICONS as Record<string, typeof Tag>)[item.status] ?? Tag;
  return (
    <article
      data-status={item.status}
      className={cn("relative flex h-full flex-col gap-3 rounded-card border p-5 text-sm transition-shadow hover:shadow-e2 motion-reduce:transition-none", isNew ? "border-orange-text/40 bg-orange-tint shadow-[inset_4px_0_0_var(--ds-orange-text),var(--ds-shadow-1)]" : "border-line bg-surface shadow-e1")}
    >
      <Badge variant={enquiryTone(item.status)} icon={Icon} className="w-fit" data-chip={item.status}>
        {companyStatusLabel(item.status)}
      </Badge>
      <h2 className="type-subheading text-ink">
        <Link href={href} className="inline-flex min-h-11 items-center rounded-field outline-none after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-text">
          {format(text.receivedOn, { date: formatLongDate(item.created_at) ?? item.created_at })}
        </Link>
      </h2>
      <p className="text-ink-2">{format(text.district, { district: item.district })}</p>
    </article>
  );
}
