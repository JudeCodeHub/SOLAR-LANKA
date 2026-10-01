import { UnspecifiedValue } from "@/components/catalogue/detail/unspecified-value";
import { completenessSummary, type SpecGroup } from "@/lib/catalogue/detail";
import { format, messages } from "@/messages";

const text = messages.detail.specs;

/** Every specification with its unit, grouped. Values the catalogue does not hold are labelled. */
export function SpecificationTable({ groups }: { groups: SpecGroup[] }) {
  return (
    <section aria-labelledby="specs-title" className="space-y-4">
      <h2 id="specs-title" className="font-heading text-2xl font-semibold tracking-tight">
        {text.title}
      </h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{text.unspecifiedNote}</p>
      <p className="text-sm font-medium">{completenessSummary(groups)}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <h3 className="font-medium">{group.title}</h3>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{format(text.caption, { group: group.title })}</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{text.property}</th>
                  <th scope="col">{text.value}</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <th scope="row" className="w-1/2 py-2 pr-4 text-left align-top font-normal text-muted-foreground">
                      {row.label}
                    </th>
                    <td className="py-2 align-top">
                      {row.value === null ? <UnspecifiedValue /> : row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {group.note ? <p className="text-xs text-muted-foreground">{group.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
