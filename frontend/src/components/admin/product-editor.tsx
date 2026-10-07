"use client";

import { BackLink } from "@/components/ui/back-link";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { useAdminProduct, useArchiveProduct, useEditProduct } from "@/lib/admin/hooks";
import { type FieldDef, INVERTER_FIELDS, nameChanges, PANEL_FIELDS, specChanges, toValues, validateNames, validateSpecs, type Values } from "@/lib/admin/catalogue";
import { format, messages } from "@/messages";

const text = messages.adminCatalogue;

/** Edit one product's name and specifications, or archive it, with the platform administrator's permission. */
export function ProductEditor({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/admin/catalogue">{text.back}</BackLink>
      <PlatformGate>{() => <Loader id={id} />}</PlatformGate>
    </div>
  );
}

function Loader({ id }: { id: string }) {
  const query = useAdminProduct(id);
  return (
    <QueryState query={query} isEmpty={(product) => product === null} empty={<p className="type-body rounded-card border border-line bg-surface p-4 text-ink" data-not-found>{text.notFound}</p>}>
      {(product) =>
        product ? (
          // Keyed by the stored values so a refresh after saving resets the form to what is now stored.
          <ProductForm key={JSON.stringify([product.brand, product.model, product.specifications])} id={id} product={product} />
        ) : null
      }
    </QueryState>
  );
}

type Product = NonNullable<ReturnType<typeof useAdminProduct>["data"]>;

/** The edit form for one stored product, shown by the editor page once the product has loaded. */
export function ProductForm({ id, product }: { id: string; product: Product }) {
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
      <div key={key} className="space-y-1.5">
        <label htmlFor={fid} className="block font-medium text-ink">
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
          <p id={`${fid}-error`} className="flex items-center gap-1.5 text-sm font-medium text-danger" data-error={key}>
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <PageHeader eyebrow={text.editEyebrow} title={format(text.editTitle, { name: displayName })} />
      {notice ? (
        <Alert variant="success" role="status" data-notice>
          <CircleCheck aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{refused}</AlertDescription>
        </Alert>
      ) : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      {Object.keys(errors).length > 0 ? (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-card border-2 border-danger bg-danger-tint p-4 text-sm font-medium text-ink outline-none" data-error-summary>
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
        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="names">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.namesTitle}</legend>
          {input("brand", names, setNames)}
          {input("model", names, setNames)}
        </fieldset>
        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-section="specs">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.specsTitle}</legend>
          <p className="type-small clear-both text-ink-2">{text.specsHelp}</p>
          {fields.map((def) => input(def.key, specs, setSpecs, def))}
        </fieldset>
        <Button type="submit" size="lg" aria-disabled={edit.isPending} data-action="save">
          {edit.isPending ? text.saving : text.save}
        </Button>
      </form>
      <section aria-labelledby="archive-title" className="space-y-3 rounded-card border-2 border-dashed border-ink-3 bg-paper-2 p-5 sm:p-6" data-archive-section>
        <h2 id="archive-title" className="type-heading text-ink">
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
