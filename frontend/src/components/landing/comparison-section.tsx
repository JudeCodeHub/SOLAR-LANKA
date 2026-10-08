import { Building2, Sun } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { TableRegion } from "@/components/ui/table";
import { messages } from "@/messages";

const text = messages.landing.story.comparison;

/** How strongly each row's gap column is tinted: the bigger the system, the bigger the gap and the warmer the cell. */
const TINT = [6, 13, 22, 33, 46] as const;

const HEAD = "px-5 py-5 text-left align-middle text-xs font-semibold tracking-widest uppercase sm:px-7";

/** A comparison of two sample offers across five system sizes: the gap column warms up as it grows, in the page's own colours. The figures are samples and are labelled as such. */
export function ComparisonSection() {
  return (
    <Section space="l" labelledBy="comparison-title" id="compare" className="scroll-mt-24 lg:flex lg:min-h-svh lg:items-center">
      <Container size="wide" className="space-y-10" data-comparison-section>
        <div className="max-w-2xl space-y-4">
          <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{text.eyebrow}</p>
          <h2 id="comparison-title" className="type-display-m text-ink">{text.title}</h2>
          <p className="type-body text-ink-2">{text.body}</p>
        </div>
        <TableRegion label={text.region} className="rounded-3xl border-line bg-surface shadow-e2">
          <table className="w-full min-w-[46rem] border-collapse text-base text-ink">
            <caption className="sr-only">{text.caption}</caption>
            <thead>
              <tr className="bg-paper-2">
                <th scope="col" className={`${HEAD} text-ink-3`}>{text.stage}</th>
                <th scope="col" className={`${HEAD} text-ink-2`}>
                  <span className="flex items-center gap-3 normal-case tracking-normal">
                    <span aria-hidden className="grid size-9 place-items-center rounded-full bg-line text-ink-2">
                      <Building2 className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">{text.offerA}</span>
                  </span>
                </th>
                <th scope="col" className={`${HEAD} text-ink`}>
                  <span className="flex items-center gap-3 normal-case tracking-normal">
                    <span aria-hidden className="grid size-9 place-items-center rounded-full bg-orange text-on-orange">
                      <Sun className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">{text.offerB}</span>
                  </span>
                </th>
                <th scope="col" className={`${HEAD} text-orange-text`}>{text.gap}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(text.rows).map((row, index) => (
                <tr key={row.name} className="border-t border-line" data-row={index}>
                  <th scope="row" className="px-5 py-6 text-left align-middle font-normal sm:px-7">
                    <span className="block text-lg font-semibold text-ink">{row.name}</span>
                    <span className="mt-1 block text-sm text-ink-2">{row.detail}</span>
                  </th>
                  <td className="type-figure px-5 py-6 align-middle text-ink-2 sm:px-7">{row.a}</td>
                  <td className="type-figure px-5 py-6 align-middle font-semibold text-ink sm:px-7">{row.b}</td>
                  <td
                    className="px-5 py-6 align-middle sm:px-7"
                    style={{ backgroundColor: `color-mix(in srgb, var(--ds-orange) ${TINT[index] ?? 6}%, transparent)` }}
                    data-gap
                  >
                    <span className="type-figure block text-lg font-semibold text-ink">{row.gap}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{row.share}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </Container>
    </Section>
  );
}
