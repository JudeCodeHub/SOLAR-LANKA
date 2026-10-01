import { UnspecifiedValue } from "@/components/catalogue/detail/unspecified-value";
import { ExternalLink } from "@/components/catalogue/detail/external-link";
import { formatLongDate, type SourceInfo } from "@/lib/catalogue/detail";
import { messages } from "@/messages";

const text = messages.detail.source;

/** Where the specifications come from and when they were last checked. */
export function SourceSection({ source }: { source: SourceInfo }) {
  const verified = formatLongDate(source.verifiedAt);
  return (
    <section aria-labelledby="source-title" className="space-y-3">
      <h2 id="source-title" className="font-heading text-2xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{text.intro}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{text.source}</dt>
        <dd>
          {source.url ? (
            <ExternalLink href={source.url}>{text.open}</ExternalLink>
          ) : (
            <span data-no-source>{text.noSource}</span>
          )}
        </dd>
        <dt className="text-muted-foreground">{text.verified}</dt>
        <dd>{verified ?? <UnspecifiedValue />}</dd>
      </dl>
    </section>
  );
}
