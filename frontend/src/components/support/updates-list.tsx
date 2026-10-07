import { ArrowRightLeft, MessageSquare, UserCheck, UserMinus, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format/datetime";
import { type CaseUpdate } from "@/lib/support/hooks";
import { roleLabel } from "@/lib/support/support";
import { format, messages } from "@/messages";

const text = messages.support;
const day = formatDateTime;
const ICONS: Record<string, LucideIcon> = { message: MessageSquare, status: ArrowRightLeft, assigned: UserCheck, unassigned: UserMinus };

/** The history of a case, as cards on a line, newest where the list puts them. Company-side views show who acted and mark internal entries. */
export function UpdatesList({ updates, companySide }: { updates: CaseUpdate[]; companySide: boolean }) {
  if (updates.length === 0) return <p className="type-body text-ink-2">{messages.support.customer.noUpdates}</p>;
  return (
    <ul className="relative space-y-3 text-sm before:absolute before:top-3 before:bottom-3 before:left-[0.9375rem] before:w-0.5 before:bg-line" data-updates>
      {updates.map((update) => {
        const Icon = ICONS[update.kind] ?? MessageSquare;
        return (
          <li key={update.id} className="relative pl-11" data-update={update.kind} data-shared={update.shared}>
            <span aria-hidden className="absolute top-3 left-0 grid size-8 place-items-center rounded-full border-2 border-line bg-surface text-ink-2">
              <Icon className="size-4" />
            </span>
            <div className="space-y-1 rounded-card border border-line bg-surface p-4 shadow-e1">
              <p className="text-ink-2">{companySide ? format(text.byline, { role: roleLabel(update.actor_role), date: day(update.created_at) }) : day(update.created_at)}</p>
              <p className="font-medium text-ink">
                {update.kind === "status"
                  ? format(messages.support.updateStatus, { from: (text.statuses as Record<string, string>)[update.from_status ?? ""] ?? "", to: (text.statuses as Record<string, string>)[update.to_status ?? ""] ?? "" })
                  : (text.kinds as Record<string, string>)[update.kind]}
              </p>
              {update.body ? <p className="whitespace-pre-wrap text-ink">{update.body}</p> : null}
              {companySide ? (
                <Badge variant={update.shared ? "info" : "neutral"} className="mt-1">
                  {update.shared ? text.company.sharedTag : text.company.internal}
                </Badge>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
