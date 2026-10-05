import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { DISTRICTS, SERVICES } from "@/lib/directory/options";
import type { DirectoryState } from "@/lib/directory/params";
import { serviceLabel } from "@/lib/landing/format";
import { messages } from "@/messages";

const selectClass = "field-control field-select h-11 w-full min-w-0 px-3.5 py-2";

const text = messages.directory.filters;

function Choice({
  name,
  label,
  any,
  options,
  value,
  error,
}: {
  name: string;
  label: string;
  any: string;
  options: readonly { value: string; label: string }[];
  value: string;
  error?: string;
}) {
  const id = `filter-${name}`;
  const errorId = `${id}-error`;
  // A value that is not an option.
  const known = options.some((option) => option.value === value);
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        name={name}
        defaultValue={known ? value : ""}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={selectClass}
      >
        <option value="">{any}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <FieldError id={errorId} role={undefined}>
          {error}
        </FieldError>
      ) : null}
    </Field>
  );
}

/** District and service as an ordinary GET form, so the choice ends up in the address. */
export function DirectoryFilters({ basePath, state }: { basePath: string; state: DirectoryState }) {
  const { values, errors } = state;
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            name="district"
            label={text.district}
            any={text.districtAny}
            options={DISTRICTS.map((district) => ({ value: district, label: district }))}
            value={values.district ?? ""}
            error={errors.district}
          />
          <Choice
            name="service"
            label={text.service}
            any={text.serviceAny}
            options={SERVICES.map((service) => ({ value: service, label: serviceLabel(service) }))}
            value={values.service ?? ""}
            error={errors.service}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">{text.apply}</Button>
          {Object.keys(values).length > 0 ? (
            <Link href={basePath} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
              {text.clear}
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}
