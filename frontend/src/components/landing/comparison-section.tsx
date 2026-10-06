import { Container } from "@/components/ui/container";
import { SampleBadge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { Table, TableRegion } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { messages } from "@/messages";

const text = messages.landing.story.comparison;
const compare = messages.customerOffers.compare;

const OFFERS = ["a", "b", "c"] as const;
type OfferId = (typeof OFFERS)[number];
const ROWS = ["size", "panels", "inverter", "battery", "warranty", "total"] as const;

/** A missing value is not specified, as in the real comparison; a row is flagged when the offers differ or some say nothing. */
function flag(values: Partial<Record<OfferId, string>>): "same" | "differs" | "unspecified" {
  const given = OFFERS.map((id) => values[id]).filter((value): value is string => value !== undefined);
  if (given.length < OFFERS.length) return "unspecified";
  return new Set(given).size > 1 ? "differs" : "same";
}

/** A real, styled comparison table with sample data, flagged and worded exactly like the one customers get. */
export function ComparisonSection() {
  return (
    <Section space="l" labelledBy="comparison-title">
      <Container size="content" className="space-y-10" data-comparison-section>
        <div className="max-w-2xl space-y-4">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
          <h2 id="comparison-title" className="type-display-m text-ink">{text.title}</h2>
          <p className="type-body text-ink-2">{text.body}</p>
          <SampleBadge>{text.sampleLabel}</SampleBadge>
        </div>
        <TableRegion label={text.region}>
          <Table className="min-w-[40rem]">
            <caption className="sr-only">{text.caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-56 text-left">{text.item}</th>
                {OFFERS.map((id) => (
                  <th key={id} scope="col" className="text-left">{text.offers[id]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const data: { label: string } & Partial<Record<OfferId, string>> = text.rows[row];
                const kind = flag(data);
                return (
                  <tr key={row} className="align-top" data-row={row} data-flag={kind}>
                    <th scope="row" className="text-left font-normal">
                      <span className="block">{data.label}</span>
                      {kind === "differs" ? <span className="mt-1 block text-xs font-medium text-ink" data-flag="differs">{compare.differs}</span> : null}
                      {kind === "unspecified" ? <span className="mt-1 block text-xs text-ink-2" data-flag="unspecified">{compare.someUnspecified}</span> : null}
                    </th>
                    {OFFERS.map((id) => (
                      <td key={id} className={cn(row === "total" && "type-figure font-semibold")}>
                        {data[id] === undefined ? (
                          <span className="rounded-full border border-dashed border-field-border px-2 py-0.5 text-xs text-ink-2" data-cell="unspecified">{messages.catalogue.card.unspecified}</span>
                        ) : (
                          data[id]
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableRegion>
      </Container>
    </Section>
  );
}
