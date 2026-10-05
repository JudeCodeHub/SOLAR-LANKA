import Link from "next/link";

import { FilterField } from "@/components/catalogue/filter-field";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { CatalogueKind, CatalogueState } from "@/lib/catalogue/params";
import { messages } from "@/messages";

const selectClass = "field-control field-select h-11 w-full min-w-0 px-3.5 py-2";

/** Search and filters as an ordinary GET form, so the chosen values end up in the address. */
export function CatalogueFilters({
  kind,
  basePath,
  state,
}: {
  kind: CatalogueKind;
  basePath: string;
  state: CatalogueState;
}) {
  const text = messages.catalogue.filters;
  const { values, errors } = state;
  const anyFilter = Object.keys(values).length > 0;
  return (
    <section aria-labelledby="filters-title">
      <h2 id="filters-title" className="sr-only">
        {text.heading}
      </h2>
      <form
        method="get"
        action={basePath}
        role="search"
        aria-label={text.label}
        className="space-y-4 rounded-lg border bg-card p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <FilterField
              name="q"
              type="search"
              label={text.search}
              placeholder={text.searchPlaceholder}
              value={values.q ?? ""}
              error={errors.q}
            />
          </div>
          {kind === "panel" ? (
            <>
              <FilterField name="min_w" label={text.minPower} inputMode="decimal" value={values.min_w ?? ""} error={errors.min_w} />
              <FilterField name="max_w" label={text.maxPower} inputMode="decimal" value={values.max_w ?? ""} error={errors.max_w} />
              <FilterField name="min_eff" label={text.minEfficiency} inputMode="decimal" value={values.min_eff ?? ""} error={errors.min_eff} />
            </>
          ) : (
            <>
              <Field data-invalid={Boolean(errors.type)}>
                <FieldLabel htmlFor="filter-type">{text.type}</FieldLabel>
                <select
                  id="filter-type"
                  name="type"
                  defaultValue={values.type ?? ""}
                  aria-invalid={Boolean(errors.type)}
                  className={selectClass}
                >
                  <option value="">{text.typeAny}</option>
                  <option value="on_grid">{text.typeOptions.on_grid}</option>
                  <option value="off_grid">{text.typeOptions.off_grid}</option>
                  <option value="hybrid">{text.typeOptions.hybrid}</option>
                </select>
              </Field>
              <FilterField name="min_kw" label={text.minCapacity} inputMode="decimal" value={values.min_kw ?? ""} error={errors.min_kw} />
              <FilterField name="max_kw" label={text.maxCapacity} inputMode="decimal" value={values.max_kw ?? ""} error={errors.max_kw} />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">{text.apply}</Button>
          {anyFilter ? (
            <Link href={basePath} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
              {text.clear}
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}
