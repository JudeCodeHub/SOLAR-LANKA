import { Clock, FlaskConical, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, SampleBadge, TimeSensitiveBadge, VerifiedBadge } from "@/components/ui/badge";
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

/** On the article page: why it is time-sensitive, the date it is valid for, and a stronger warning when it is overdue. */
export function CurrencyNotice({ article }: { article: { time_sensitive: boolean; review_overdue: boolean; valid_as_of: string | null; review_by: string | null } }) {
  const state = currency(article);
  if (state === "current") return null;
  const date = (iso: string | null) => (iso ? (formatLongDate(iso) ?? iso) : "");
  const overdue = state === "overdue";
  const Icon = overdue ? TriangleAlert : Clock;
  return (
    <Alert variant={overdue ? "danger" : "warning"} role="note" aria-labelledby="currency-title" className="border-2" data-currency={state}>
      <Icon aria-hidden />
      <AlertTitle id="currency-title">{text.timeSensitiveTitle}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{format(text.timeSensitiveBody, { date: date(article.valid_as_of) })}</p>
        {overdue ? <p className="font-medium">{format(text.overdueBody, { date: date(article.review_by) })}</p> : null}
      </AlertDescription>
    </Alert>
  );
}

/** Says plainly that a sample article is demonstration content. */
export function SampleNotice() {
  return (
    <Alert variant="info" role="note" data-notice="sample">
      <FlaskConical aria-hidden />
      <AlertDescription>{text.sampleNote}</AlertDescription>
    </Alert>
  );
}

/** The review line: when it was published and reviewed, and whether its claims were read against its sources. */
export function ReviewLine({ article, published, reviewed }: { article: { is_sample: boolean }; published: string; reviewed: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-review-line>
      <p className="type-small text-ink-2">{format(text.publishedReviewed, { published, reviewed })}</p>
      {article.is_sample ? null : <VerifiedBadge data-badge="verified">{text.verifiedBadge}</VerifiedBadge>}
    </div>
  );
}
