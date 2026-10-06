import { X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { DISTRICTS, SERVICES } from "@/lib/directory/options";
import { buildDirectoryHref, type DirectoryState } from "@/lib/directory/params";
import { serviceLabel } from "@/lib/landing/format";
import { format, messages } from "@/messages";

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
        // A new key whenever the filters in the address change, so the fields follow a chip or link.
        key={JSON.stringify(values)}
        method="get"
        action={basePath}
        role="search"
        aria-label={text.label}
        className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-e1"
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
            <Link href={basePath} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">{text.clear}</Link>
          ) : null}
        </div>
      </form>
      {Object.keys(values).length > 0 ? (
        <ul aria-label={text.active} className="mt-3 flex flex-wrap gap-2" data-active-filters>
          {Object.entries(values).map(([key, value]) => {
            const without = { ...values };
            delete without[key as keyof typeof without];
            const label = key === "district" ? text.district : text.service;
            const shown = key === "service" ? serviceLabel(value) : value;
            return (
              <li key={key}>
                <Link
                  href={buildDirectoryHref(basePath, { values: without, page: 1 })}
                  aria-label={format(text.remove, { filter: label, value: shown })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper-2 px-4 text-sm font-medium text-ink hover:bg-orange-tint"
                >
                  <span>
                    {label}: {shown}
                  </span>
                  <X aria-hidden className="size-4 text-ink-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
