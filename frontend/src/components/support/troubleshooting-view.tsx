"use client";

import { CircleAlert, OctagonAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Photo } from "@/components/ui/photo";
import { type Lookup, useLookup } from "@/lib/support/hooks";
import { lookupQuery, ordered } from "@/lib/support/support";
import { formatLongDate } from "@/lib/catalogue/detail";
import { format, messages } from "@/messages";

const text = messages.troubleshooting;

/** Look up guidance for one exact model. Hazards stop the routine steps; a different model is never substituted. */
export function TroubleshootingView() {
  const [model, setModel] = useState("");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState<Record<string, string> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const result = useLookup(query);

  const ask = (productId?: string) => {
    const next = lookupQuery({ model, code, productId });
    setProblem(next === null ? text.needModel : null);
    if (next !== null) setQuery(next);
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form
          noValidate
          className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6"
          data-lookup-form
          onSubmit={(event) => {
            event.preventDefault();
            ask();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="model" className="type-subheading block text-ink">
              {text.modelLabel}
            </label>
            <input id="model" value={model} onChange={(event) => setModel(event.target.value)} maxLength={100} aria-invalid={Boolean(problem)} aria-describedby={`model-help${problem ? " model-error" : ""}`} autoComplete="off" className="field-control h-11 w-full px-3.5" />
            <p id="model-help" className="type-small text-ink-2">
              {text.modelHelp}
            </p>
            {problem ? (
              <p id="model-error" role="alert" className="flex items-center gap-2 text-sm font-medium text-danger" data-error="model">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                {problem}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="code" className="type-subheading block text-ink">
              {text.codeLabel}
            </label>
            <input id="code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={64} aria-describedby="code-help" autoComplete="off" className="field-control h-11 w-full px-3.5" />
            <p id="code-help" className="type-small text-ink-2">
              {text.codeHelp}
            </p>
          </div>
          <Button type="submit" aria-disabled={result.isFetching} data-action="lookup">
            {result.isFetching ? text.searching : text.search}
          </Button>
        </form>
        <aside aria-labelledby="find-title" className="overflow-hidden rounded-card border border-line bg-surface shadow-e1" data-find-model>
          <div aria-hidden>
            <Photo name="photographDisplay" sizes="(min-width: 1024px) 320px, 100vw" className="aspect-[16/10] w-full object-cover" />
          </div>
          <div className="space-y-2 p-5">
            <h2 id="find-title" className="type-subheading text-ink">
              {text.findTitle}
            </h2>
            <p className="type-small text-ink-2">{text.findBody}</p>
          </div>
        </aside>
      </div>
      {result.error ? <ApiErrorMessage error={result.error} /> : null}
      {result.data && query ? <Result data={result.data} choose={ask} /> : null}
    </div>
  );
}

function Result({ data, choose }: { data: Lookup; choose: (productId: string) => void }) {
  const name = data.product ? format(messages.support.customer.equipment, { name: `${data.product.brand} ${data.product.model}` }) : "";
  if (data.match !== "exact") {
    return (
      <section aria-labelledby="result-title" className="space-y-3" data-result={data.match}>
        <h2 id="result-title" className="font-heading text-xl font-semibold tracking-tight">
          {data.match === "ambiguous" ? text.ambiguousTitle : text.none}
        </h2>
        <p className="text-sm">{data.notice}</p>
        {data.suggestions.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-medium">{data.match === "ambiguous" ? text.ambiguousHelp : text.suggestionsTitle}</h3>
            {data.match === "none" ? <p className="text-sm text-muted-foreground">{text.suggestionsHelp}</p> : null}
            <ul className="space-y-1" data-suggestions>
              {data.suggestions.map((product) => (
                <li key={product.id}>
                  <Button type="button" variant="outline" size="sm" onClick={() => choose(product.id)}>
                    {format(text.choose, { name: `${product.brand} ${product.model}` })}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }
  const references = ordered(data.references);
  return (
    <section aria-labelledby="result-title" className="space-y-4" data-result="exact">
      <h2 id="result-title" className="font-heading text-xl font-semibold tracking-tight">
        {format(text.exactFor, { name: name.replace(/^About: /, "") })}
      </h2>
      {references.length === 0 ? (
        <p className="text-sm" data-no-references>
          {data.notice}
        </p>
      ) : null}
      {references.map((reference) => (
        <article key={reference.id} className={`space-y-2 rounded-lg border p-4 text-sm`} data-reference={reference.safety_level}>
          {reference.safety_level === "hazard" ? (
            <Alert variant="hazard" data-hazard>
              <OctagonAlert aria-hidden />
              <div className="space-y-1">
                <p>{text.hazardTitle}</p>
                <p>{reference.hazard_warning}</p>
                <p>{text.hazardEscalate}</p>
              </div>
            </Alert>
          ) : (
            <p className="font-medium" data-safe>
              {text.safeTitle}
            </p>
          )}
          <h3 className="text-base font-semibold">{reference.title}</h3>
          {reference.code ? <p className="text-muted-foreground">{format(text.code, { code: reference.code })}</p> : null}
          {reference.safety_level === "safe_observation" ? <p className="text-muted-foreground">{text.safeHelp}</p> : null}
          {reference.safety_level === "safe_observation" ? (
            <ol className="list-decimal space-y-1 pl-5" aria-label={text.stepsLabel}>
              {reference.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          ) : null}
          <p className="text-muted-foreground" data-source>
            {format(text.source, { title: reference.source_title })}
            {reference.source_page ? ` ${format(text.sourcePage, { page: reference.source_page })}` : ""}
          </p>
          {reference.verified_on ? <p className="text-muted-foreground">{format(text.verified, { date: formatLongDate(reference.verified_on) ?? reference.verified_on })}</p> : null}
          <a href={reference.source_url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center underline underline-offset-2">
            {text.open}
          </a>
          {reference.is_sample ? <p className="text-xs text-muted-foreground">{text.sampleNote}</p> : null}
        </article>
      ))}
      <Link href={`/my/support?product=${data.product?.id ?? ""}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">
        {text.report}
      </Link>
    </section>
  );
}
