import { Table } from "@/components/ui/table";
import { UnspecifiedValue } from "@/components/catalogue/detail/unspecified-value";
import { completenessSummary, type SpecGroup } from "@/lib/catalogue/detail";
import { format, messages } from "@/messages";

const text = messages.detail.specs;

/** Every specification with its unit, grouped. Values the catalogue does not hold are labelled. */
export function SpecificationTable({ groups }: { groups: SpecGroup[] }) {
  return (
    <section aria-labelledby="specs-title" className="space-y-4">
      <h2 id="specs-title" className="type-heading text-ink">
        {text.title}
      </h2>
      <p className="type-small max-w-3xl text-ink-2">{text.unspecifiedNote}</p>
      <p className="type-small font-medium text-ink">{completenessSummary(groups)}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1">
            <h3 className="type-subheading text-ink">{group.title}</h3>
            <Table className="w-full border-collapse text-sm">
              <caption className="sr-only">{format(text.caption, { group: group.title })}</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{text.property}</th>
                  <th scope="col">{text.value}</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="w-1/2 text-left align-top font-normal text-ink-2">
                      {row.label}
                    </th>
                    <td className="type-figure align-top font-medium">
                      {row.value === null ? <UnspecifiedValue /> : row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {group.note ? <p className="type-small text-ink-3">{group.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
