import { formatLongDate } from "@/lib/catalogue/detail";
import { currency } from "@/lib/education/education";
import { format, messages } from "@/messages";

const text = messages.education;

/** The small badges that tell a reader an article depends on things that change, or is past its check date. */
export function Badges({ article }: { article: { time_sensitive: boolean; review_overdue: boolean; is_sample: boolean } }) {
  const state = currency(article);
  return (
    <p className="flex flex-wrap gap-2 text-xs" data-badges>
      {state === "time-sensitive" ? <span className="rounded-full border border-foreground px-2 py-0.5 font-medium" data-badge="time-sensitive">{text.timeSensitiveBadge}</span> : null}
      {state === "overdue" ? <span className="rounded-full border-2 border-destructive px-2 py-0.5 font-medium" data-badge="overdue">{text.overdueBadge}</span> : null}
      {article.is_sample ? <span className="rounded-full border px-2 py-0.5" data-badge="sample">{text.sampleBadge}</span> : null}
    </p>
  );
}

/** On the article page: why it is time-sensitive, the date it is valid for, and a warning when it is overdue. */
export function CurrencyNotice({ article }: { article: { time_sensitive: boolean; review_overdue: boolean; valid_as_of: string | null; review_by: string | null } }) {
  const state = currency(article);
  if (state === "current") return null;
  const date = (iso: string | null) => (iso ? (formatLongDate(iso) ?? iso) : "");
  return (
    <section aria-labelledby="currency-title" role="note" className="space-y-1 rounded-lg border-2 border-foreground p-3 text-sm" data-currency={state}>
      <h2 id="currency-title" className="font-semibold">
        {text.timeSensitiveTitle}
      </h2>
      <p>{format(text.timeSensitiveBody, { date: date(article.valid_as_of) })}</p>
      {state === "overdue" ? <p className="font-medium">{format(text.overdueBody, { date: date(article.review_by) })}</p> : null}
    </section>
  );
}
