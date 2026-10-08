"use client";

import { CircleAlert, Info, OctagonAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ExternalLink } from "@/components/catalogue/detail/external-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Photo } from "@/components/ui/photo";
import { type Lookup, useLookup } from "@/lib/support/hooks";
import { lookupQuery, ordered } from "@/lib/support/support";
import { formatLongDate, safeExternalUrl } from "@/lib/catalogue/detail";
import { cn } from "@/lib/utils";
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
        <aside className="overflow-hidden rounded-card border border-line bg-surface shadow-e1" data-find-model>
          <div aria-hidden>
            <Photo name="photographDisplay" sizes="(min-width: 1024px) 320px, 100vw" className="aspect-[16/10] w-full object-cover" />
          </div>
          <div className="space-y-2 p-5">
            <h2 className="type-subheading text-ink">
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
      <section aria-labelledby="result-title" className="space-y-4" data-result={data.match}>
        <h2 id="result-title" className="type-heading text-ink">
          {data.match === "ambiguous" ? text.ambiguousTitle : text.none}
        </h2>
        <Alert variant="info" role="note">
          <Info aria-hidden />
          <AlertDescription>{data.notice}</AlertDescription>
        </Alert>
        {data.suggestions.length > 0 ? (
          <div className="space-y-3">
            <h3 className="type-subheading text-ink">{data.match === "ambiguous" ? text.ambiguousHelp : text.suggestionsTitle}</h3>
            {data.match === "none" ? <p className="type-small text-ink-2">{text.suggestionsHelp}</p> : null}
            <ul className="flex flex-wrap gap-3" data-suggestions>
              {data.suggestions.map((product) => (
                <li key={product.id}>
                  <Button type="button" variant="outline" onClick={() => choose(product.id)}>
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
    <section aria-labelledby="result-title" className="space-y-5" data-result="exact">
      <h2 id="result-title" className="type-heading text-ink">
        {format(text.exactFor, { name: name.replace(/^About: /, "") })}
      </h2>
      {references.length === 0 ? (
        <Alert variant="info" role="note" data-no-references>
          <Info aria-hidden />
          <AlertDescription>{data.notice}</AlertDescription>
        </Alert>
      ) : null}
      {references.map((reference) => {
        const hazard = reference.safety_level === "hazard";
        const link = safeExternalUrl(reference.source_url);
        return (
          <article
            key={reference.id}
            className={cn("space-y-3 rounded-card bg-surface p-5 text-sm", hazard ? "border-2 border-danger shadow-e2" : "border border-line shadow-e1")}
            data-reference={reference.safety_level}
          >
            {hazard ? (
              <Alert variant="hazard" data-hazard>
                <OctagonAlert aria-hidden className="size-6" />
                <div className="space-y-1">
                  <p className="type-subheading">{text.hazardTitle}</p>
                  <p>{reference.hazard_warning}</p>
                  <p>{text.hazardEscalate}</p>
                </div>
              </Alert>
            ) : (
              <p data-safe>
                <Badge variant="success" icon={ShieldCheck}>
                  {text.safeTitle}
                </Badge>
              </p>
            )}
            <h3 className="type-heading text-ink">{reference.title}</h3>
            {reference.code ? <p className="type-figure text-ink-2">{format(text.code, { code: reference.code })}</p> : null}
            {reference.safety_level === "safe_observation" ? <p className="text-ink-2">{text.safeHelp}</p> : null}
            {reference.safety_level === "safe_observation" ? (
              <ol className="list-decimal space-y-2 pl-6 text-base text-ink marker:font-semibold marker:text-orange-text" aria-label={text.stepsLabel}>
                {reference.steps.map((step, index) => (
                  <li key={index} className="pl-1">
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="space-y-1 border-t border-line pt-3">
              <p className="text-ink-2" data-source>
                {format(text.source, { title: reference.source_title })}
                {reference.source_page ? ` ${format(text.sourcePage, { page: reference.source_page })}` : ""}
              </p>
              {reference.verified_on ? <p className="text-ink-2">{format(text.verified, { date: formatLongDate(reference.verified_on) ?? reference.verified_on })}</p> : null}
              {link ? (
                <p className="font-medium text-orange-text">
                  <ExternalLink href={link}>{text.open}</ExternalLink>
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
      <Link href={`/my/support?product=${data.product?.id ?? ""}`} className={buttonVariants({ variant: "secondary" })}>
        {text.report}
      </Link>
    </section>
  );
}
