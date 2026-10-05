import { Badge, SampleBadge, TimeSensitiveBadge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/catalogue/detail";
import { currency } from "@/lib/education/education";
import { format, messages } from "@/messages";

const text = messages.education;

/** The small badges that tell a reader an article depends on things that change, or is past its check date. */
export function Badges({ article }: { article: { time_sensitive: boolean; review_overdue: boolean; is_sample: boolean } }) {
  const state = currency(article);
  return (
    <p className="flex flex-wrap gap-2" data-badges>
      {state === "time-sensitive" ? <TimeSensitiveBadge data-badge="time-sensitive">{text.timeSensitiveBadge}</TimeSensitiveBadge> : null}
      {state === "overdue" ? <Badge variant="danger" data-badge="overdue">{text.overdueBadge}</Badge> : null}
      {article.is_sample ? <SampleBadge data-badge="sample">{text.sampleBadge}</SampleBadge> : null}
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
