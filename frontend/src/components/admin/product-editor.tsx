"use client";

import { BackLink } from "@/components/ui/back-link";
import { useMemo, useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { useAdminProduct, useArchiveProduct, useEditProduct } from "@/lib/admin/hooks";
import { type FieldDef, INVERTER_FIELDS, nameChanges, PANEL_FIELDS, specChanges, toValues, validateNames, validateSpecs, type Values } from "@/lib/admin/catalogue";
import { format, messages } from "@/messages";

const text = messages.adminCatalogue;

/** Edit one product's name and specifications, or archive it, with the platform administrator's permission. */
export function ProductEditor({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/admin/catalogue">{text.back}</BackLink>
      <PlatformGate>{() => <Loader id={id} />}</PlatformGate>
    </div>
  );
}

function Loader({ id }: { id: string }) {
  const query = useAdminProduct(id);
  return (
    <QueryState query={query} isEmpty={(product) => product === null} empty={<p className="text-sm" data-not-found>{text.notFound}</p>}>
      {(product) =>
        product ? (
          // Keyed by the stored values so a refresh after saving resets the form to what is now stored.
          <Form key={JSON.stringify([product.brand, product.model, product.specifications])} id={id} product={product} />
        ) : null
      }
    </QueryState>
  );
}

type Product = NonNullable<ReturnType<typeof useAdminProduct>["data"]>;

function Form({ id, product }: { id: string; product: Product }) {
  const kind = product.kind;
  const fields: readonly FieldDef[] = kind === "panel" ? PANEL_FIELDS : INVERTER_FIELDS;
  const originalNames: Values = useMemo(() => ({ brand: product.brand, model: product.model }), [product]);
  const originalSpecs: Values = useMemo(() => toValues(product.specifications as unknown as Record<string, unknown>, fields), [product, fields]);
  const [names, setNames] = useState<Values>(originalNames);
  const [specs, setSpecs] = useState<Values>(originalSpecs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const edit = useEditProduct(id, kind);
  const archive = useArchiveProduct(id);
  const busy = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const displayName = format(text.fullName, { brand: product.brand, model: product.model });

  const clear = () => {
    setNotice(null);
    setRefused(null);
    setFailure(null);
  };
  const submit = () => {
    if (busy.current || edit.isPending) return;
    clear();
    const found = { ...validateNames(names, originalNames), ...validateSpecs(fields, specs, originalSpecs) };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTimeout(() => summary.current?.focus(), 0);
      return;
    }
    const body = { names: nameChanges(names, originalNames), specs: specChanges(fields, specs, originalSpecs) };
    if (Object.keys(body.names).length === 0 && Object.keys(body.specs).length === 0) {
      setNotice(text.nothing);
      return;
    }
    busy.current = true;
    edit.mutate(body, {
      onSuccess: () => {
        busy.current = false;
        setNotice(text.saved);
      },
      onError: (error) => {
        busy.current = false;
        if (error.status === 409 || error.status === 404) setRefused(text.refusedArchived);
        else if (error.status === 422) setRefused(text.refusedGeneric);
        else setFailure(error);
      },
    });
  };
  const doArchive = () => {
    if (busy.current) return;
    clear();
    busy.current = true;
    archive.mutate(undefined, {
      onSuccess: () => {
        busy.current = false;
        setNotice(format(text.archived, { name: displayName }));
      },
      onError: (error) => {
        busy.current = false;
        if (error.status === 409 || error.status === 404) setRefused(text.refusedArchived);
        else setFailure(error);
      },
    });
  };

  const input = (key: string, values: Values, set: (next: Values) => void, def?: FieldDef) => {
    const fid = `f-${key}`;
    const error = errors[key];
    const common = {
      id: fid,
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${fid}-error` : undefined,
      className: "w-full field-control px-3",
    };
    const label = (text.fields as Record<string, string>)[key] ?? (key === "brand" ? text.brand : text.model);
    return (
      <div key={key} className="space-y-1">
        <label htmlFor={fid} className="block font-medium">
          {label}
        </label>
        {def?.kind === "category" ? (
          <select {...common} className={`${common.className} field-select h-11`} value={values[key] ?? ""} onChange={(event) => set({ ...values, [key]: event.target.value })}>
            <option value="">{text.categoryNone}</option>
            {Object.entries(text.categories).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        ) : def?.kind === "longtext" ? (
          <textarea {...common} rows={3} value={values[key] ?? ""} onChange={(event) => set({ ...values, [key]: event.target.value })} className={`${common.className} py-2`} />
        ) : (
          <input {...common} className={`${common.className} h-11`} value={values[key] ?? ""} onChange={(event) => set({ ...values, [key]: event.target.value })} autoComplete="off" />
        )}
        {error ? (
          <p id={`${fid}-error`} className="text-sm font-medium text-destructive" data-error={key}>
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{format(text.editTitle, { name: displayName })}</h1>
      {notice ? (
        <p role="status" className="text-sm font-medium" data-notice>
          {notice}
        </p>
      ) : null}
      {refused ? (
        <p role="alert" className="text-sm font-medium" data-refused>
          {refused}
        </p>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      {Object.keys(errors).length > 0 ? (
        <div ref={summary} tabIndex={-1} role="alert" className="text-sm font-medium outline-none" data-error-summary>
          <p>{text.summary}</p>
          <ul className="list-disc pl-5">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <form
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset className="space-y-3">
          <legend className="font-heading text-xl font-semibold tracking-tight">{text.namesTitle}</legend>
          {input("brand", names, setNames)}
          {input("model", names, setNames)}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-heading text-xl font-semibold tracking-tight">{text.specsTitle}</legend>
          <p className="text-sm text-muted-foreground">{text.specsHelp}</p>
          {fields.map((def) => input(def.key, specs, setSpecs, def))}
        </fieldset>
        <Button type="submit" aria-disabled={edit.isPending} data-action="save">
          {edit.isPending ? text.saving : text.save}
        </Button>
      </form>
      <section aria-labelledby="archive-title" className="space-y-2">
        <h2 id="archive-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.archiveTitle}
        </h2>
        <ConfirmAction
          id="archive"
          label={text.archive}
          help={text.archiveHelp}
          title={format(text.archiveConfirmTitle, { name: displayName })}
          body={text.archiveConfirmBody}
          yes={text.archiveYes}
          keep={text.keep}
          disabled={archive.isPending}
          onConfirm={doArchive}
        />
      </section>
    </>
  );
}
