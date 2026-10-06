import { UnspecifiedValue } from "@/components/catalogue/detail/unspecified-value";
import { ExternalLink } from "@/components/catalogue/detail/external-link";
import { formatLongDate, type SourceInfo } from "@/lib/catalogue/detail";
import { messages } from "@/messages";

const text = messages.detail.source;

/** Where the specifications come from and when they were last checked. */
export function SourceSection({ source }: { source: SourceInfo }) {
  const verified = formatLongDate(source.verifiedAt);
  return (
    <section aria-labelledby="source-title" className="space-y-3 rounded-card border border-line bg-paper-2 p-5">
      <h2 id="source-title" className="type-heading text-ink">
        {text.title}
      </h2>
      <p className="type-small max-w-3xl text-ink-2">{text.intro}</p>
      <dl className="description-list text-sm">
        <dt>{text.source}</dt>
        <dd>
          {source.url ? (
            <ExternalLink href={source.url}>{text.open}</ExternalLink>
          ) : (
            <span data-no-source>{text.noSource}</span>
          )}
        </dd>
        <dt>{text.verified}</dt>
        <dd>{verified ?? <UnspecifiedValue />}</dd>
      </dl>
    </section>
  );
}
