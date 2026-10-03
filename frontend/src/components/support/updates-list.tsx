import { type CaseUpdate } from "@/lib/support/hooks";
import { roleLabel } from "@/lib/support/support";
import { format, messages } from "@/messages";

const text = messages.support;
const day = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" });

/** The history of a case. Company-side views show who acted and mark internal entries. */
export function UpdatesList({ updates, companySide }: { updates: CaseUpdate[]; companySide: boolean }) {
  if (updates.length === 0) return <p className="text-sm text-muted-foreground">{messages.support.customer.noUpdates}</p>;
  return (
    <ul className="space-y-2 text-sm" data-updates>
      {updates.map((update) => (
        <li key={update.id} className="rounded-lg border p-3" data-update={update.kind} data-shared={update.shared}>
          <p className="text-muted-foreground">{companySide ? format(text.byline, { role: roleLabel(update.actor_role), date: day(update.created_at) }) : day(update.created_at)}</p>
          <p className="font-medium">
            {update.kind === "status"
              ? format(messages.support.updateStatus, { from: (text.statuses as Record<string, string>)[update.from_status ?? ""] ?? "", to: (text.statuses as Record<string, string>)[update.to_status ?? ""] ?? "" })
              : (text.kinds as Record<string, string>)[update.kind]}
          </p>
          {update.body ? <p className="whitespace-pre-wrap">{update.body}</p> : null}
          {companySide ? <p className="text-xs text-muted-foreground">{update.shared ? text.company.sharedTag : text.company.internal}</p> : null}
        </li>
      ))}
    </ul>
  );
}
