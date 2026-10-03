"use client";

import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { type AdminReference, resolveModel, useReferenceActions, useReferences } from "@/lib/support/hooks";
import { stepsFromText } from "@/lib/support/support";
import { format, messages } from "@/messages";

const text = messages.adminReferences;

/** Author, publish and archive sourced troubleshooting references (platform administrators only). */
export function ReferenceAdmin() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      <PlatformGate>{() => <Body />}</PlatformGate>
    </div>
  );
}

function Body() {
  const query = useReferences();
  const actions = useReferenceActions();
  const busy = useRef(false);
  const [values, setValues] = useState({ model: "", code: "", title: "", steps: "", hazard: false, warning: "", sourceTitle: "", sourceUrl: "", sourcePage: "", verified: "", sample: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState(false);
  const set = (key: keyof typeof values, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const field = (key: keyof typeof values, label: string, options: { area?: boolean; help?: string; type?: string } = {}) => {
    const id = `ref-${key}`;
    const error = errors[key];
    const common = { id, value: String(values[key]), "aria-invalid": Boolean(error), "aria-describedby": [options.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined, onChange: (event: { target: { value: string } }) => set(key, event.target.value), className: "w-full rounded-lg border bg-transparent px-3" };
    return (
      <div className="space-y-1" key={key}>
        <label htmlFor={id} className="block font-medium">
          {label}
        </label>
        {options.area ? <textarea {...common} rows={4} className="w-full rounded-lg border bg-transparent p-2" /> : <input {...common} type={options.type ?? "text"} className="h-11 w-full rounded-lg border bg-transparent px-3" />}
        {options.help ? <p id={`${id}-help`} className="text-muted-foreground">{options.help}</p> : null}
        {error ? <p id={`${id}-error`} className="font-medium text-destructive" data-error={key}>{error}</p> : null}
      </div>
    );
  };
  const refresh = (action: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setFailure(null);
    setRefused(false);
    action();
  };
  const handlers = {
    onSuccess: () => {
      busy.current = false;
    },
    onError: (error: ApiError) => {
      busy.current = false;
      if (error.status === 409 || error.status === 404) setRefused(true);
      else setFailure(error);
    },
  };

  const submit = async () => {
    if (busy.current) return;
    const found: Record<string, string> = {};
    const steps = stepsFromText(values.steps);
    if (!values.model.trim()) found.model = text.errors.model;
    if (!values.title.trim()) found.title = text.errors.title;
    if (steps.length < 1 || steps.length > 10) found.steps = text.errors.steps;
    if (values.hazard && !values.warning.trim()) found.warning = text.errors.warning;
    if (!values.sourceTitle.trim()) found.sourceTitle = text.errors.sourceTitle;
    if (!/^https?:\/\//i.test(values.sourceUrl.trim())) found.sourceUrl = text.errors.sourceUrl;
    setErrors(found);
    setNotice(null);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    busy.current = true;
    try {
      const lookup = await resolveModel(values.model.trim());
      if (lookup.match !== "exact" || !lookup.product) {
        setErrors({ model: text.errors.notOne });
        busy.current = false;
        return;
      }
      actions.create.mutate(
        { product_id: lookup.product.id, code: values.code.trim() || null, title: values.title.trim(), steps, safety_level: values.hazard ? "hazard" : "safe_observation", hazard_warning: values.hazard ? values.warning.trim() : null, source_title: values.sourceTitle.trim(), source_url: values.sourceUrl.trim(), source_page: values.sourcePage.trim() || null, verified_on: values.verified || null, is_sample: values.sample },
        {
          onSuccess: () => {
            busy.current = false;
            setNotice(text.created);
          },
          onError: (error) => {
            busy.current = false;
            setFailure(error);
          },
        },
      );
    } catch (error) {
      busy.current = false;
      setFailure(error as ApiError);
    }
  };

  return (
    <>
      {notice ? <p role="status" className="text-sm font-medium" data-notice>{notice}</p> : null}
      {refused ? <p role="alert" className="text-sm font-medium" data-refused>{text.refused}</p> : null}
      {failure ? <ApiErrorMessage error={failure} /> : null}
      <form
        noValidate
        className="space-y-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="font-heading text-xl font-semibold tracking-tight">{text.newTitle}</h2>
        {field("model", text.model, { help: text.modelHelp })}
        {field("code", text.code)}
        {field("title", text.titleLabel)}
        {field("steps", text.steps, { area: true, help: text.stepsHelp })}
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={values.hazard} onChange={(event) => set("hazard", event.target.checked)} className="size-6 shrink-0" />
          <span>{text.hazardOption}</span>
        </label>
        {values.hazard ? field("warning", text.warning, { area: true, help: text.warningHelp }) : null}
        {field("sourceTitle", text.sourceTitle)}
        {field("sourceUrl", text.sourceUrl)}
        {field("sourcePage", text.sourcePage)}
        {field("verified", text.verified, { type: "date", help: text.verifiedHelp })}
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={values.sample} onChange={(event) => set("sample", event.target.checked)} className="size-6 shrink-0" />
          <span>{text.sample}</span>
        </label>
        <Button type="submit" aria-disabled={actions.create.isPending} data-action="create-reference">
          {actions.create.isPending ? text.creating : text.create}
        </Button>
      </form>
      <section aria-labelledby="refs-title" className="space-y-2">
        <h2 id="refs-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.list}
        </h2>
        <QueryState query={query} isEmpty={(items) => items.length === 0} empty={<p className="text-sm text-muted-foreground">{text.none}</p>}>
          {(items) => (
            <ul className="space-y-2" data-references>
              {items.map((item) => (
                <Row key={item.id} item={item} refresh={refresh} handlers={handlers} actions={actions} />
              ))}
            </ul>
          )}
        </QueryState>
      </section>
    </>
  );
}

function Row({ item, refresh, handlers, actions }: { item: AdminReference; refresh: (run: () => void) => void; handlers: { onSuccess: () => void; onError: (e: ApiError) => void }; actions: ReturnType<typeof useReferenceActions> }) {
  return (
    <li className="space-y-1 rounded-lg border p-3 text-sm" data-reference-status={item.status}>
      <p className="font-medium">{item.title}</p>
      <p className="text-muted-foreground">{[text.status[item.status], item.code, item.safety_level === "hazard" ? text.hazardOption : text.safeOption].filter(Boolean).join(" · ")}</p>
      <p className="text-muted-foreground">{format(text.modelFor, { model: item.product_id.slice(0, 8) })}</p>
      <div className="flex flex-wrap gap-2">
        {item.status === "draft" ? (
          <ConfirmAction id={`pub-${item.id}`} variant="default" label={text.publish} title={text.publishTitle} body={text.publishBody} yes={text.publishYes} keep={text.keep} disabled={actions.publish.isPending} onConfirm={() => refresh(() => actions.publish.mutate(item.id, handlers))} />
        ) : null}
        {item.status !== "archived" ? (
          <ConfirmAction id={`arch-${item.id}`} label={text.archive} title={text.archiveTitle} body={text.archiveBody} yes={text.archiveYes} keep={text.keep} disabled={actions.archive.isPending} onConfirm={() => refresh(() => actions.archive.mutate(item.id, handlers))} />
        ) : null}
      </div>
    </li>
  );
}
