"use client";

import { Dropdown } from "@/components/ui/dropdown";
import { BackLink } from "@/components/ui/back-link";
import { Archive, Braces, CircleAlert, CircleCheck, Info, Lock, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiError } from "@/lib/api/errors";
import { useConfigActions, useConfigVersion, useConfigVersions } from "@/lib/admin/hooks";
import { DEFAULT_SCENARIO, parseDraft, pretty, refusalFor, SCENARIOS, type Scenario, sameJson } from "@/lib/admin/config";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.adminEstimator;

/** Edit a draft estimator version, or start one from the newest; publish or archive with confirmation. */
export function ConfigEditor({ id }: { id: string | null }) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <BackLink href="/admin/estimator">{text.back}</BackLink>
      <PlatformGate>{() => (id === null ? <NewDraft /> : <Existing id={id} />)}</PlatformGate>
    </div>
  );
}

/** A new draft starts from the newest version of its scenario (or, failing that, of another), so only what differs is changed. */
function NewDraft() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const versions = useConfigVersions();
  const same = versions.data?.find((item) => item.scenario === scenario);
  const newest = same ?? versions.data?.[0];
  const detail = useConfigVersion(newest?.id ?? null);
  return (
    <QueryState query={versions}>
      {(list) => (
        <>
          <div className="space-y-1.5 rounded-card border border-line bg-surface p-5 shadow-e1">
            <label htmlFor="f-scenario" className="type-subheading block text-ink">
              {text.scenarioLabel}
            </label>
            <Dropdown id="f-scenario" value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)} className="min-h-11 w-full field-control px-3 text-sm">
              {SCENARIOS.map((name) => (
                <option key={name} value={name}>
                  {text.scenarios[name]}
                </option>
              ))}
            </Dropdown>
            <p className="type-small text-ink-2">{text.scenarioHelp}</p>
          </div>
          {list.length === 0 ? (
            <Editor key={`blank-${scenario}`} id={null} version={null} scenario={scenario} initial={{ assumptions: "{}", sources: "{}" }} prefilledFrom={null} fromOther={false} />
          ) : (
            <QueryState query={detail}>
              {(base) => <Editor key={`${base.id}-${scenario}`} id={null} version={null} scenario={scenario} initial={{ assumptions: pretty(base.assumptions), sources: pretty(base.source_metadata) }} prefilledFrom={base.version} fromOther={same === undefined} />}
            </QueryState>
          )}
        </>
      )}
    </QueryState>
  );
}

function Existing({ id }: { id: string }) {
  const query = useConfigVersion(id);
  return (
    <QueryState query={query}>
      {(version) => <Editor key={`${version.id}-${version.status}-${version.is_archived}`} id={id} version={version} scenario={version.scenario as Scenario} initial={{ assumptions: pretty(version.assumptions), sources: pretty(version.source_metadata) }} prefilledFrom={null} fromOther={false} />}
    </QueryState>
  );
}

type Version = NonNullable<ReturnType<typeof useConfigVersion>["data"]>;

function Editor({ id, version, scenario, initial, prefilledFrom, fromOther }: { id: string | null; version: Version | null; scenario: Scenario; initial: { assumptions: string; sources: string }; prefilledFrom: number | null; fromOther: boolean }) {
  const router = useRouter();
  const actions = useConfigActions(id);
  const fresh = useConfigVersion(id);
  const [assumptions, setAssumptions] = useState(initial.assumptions);
  const [sources, setSources] = useState(initial.sources);
  const [errors, setErrors] = useState<Partial<Record<"assumptions" | "sources", string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [refused, setRefused] = useState<"save" | "publish" | "archive" | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const busy = useRef(false);
  const summary = useRef<HTMLDivElement>(null);

  const editable = version === null || (version.status === "draft" && !version.is_archived);
  const dirty = version !== null && (!sameJson(assumptions, version.assumptions) || !sameJson(sources, version.source_metadata));

  const begin = () => {
    if (busy.current) return false;
    busy.current = true;
    setNotice(null);
    setRefused(null);
    setFailure(null);
    return true;
  };
  const fail = (attempt: "save" | "publish" | "archive") => (error: ApiError) => {
    busy.current = false;
    if (error.status === 409 || error.status === 404) setRefused(attempt);
    else setFailure(error);
  };

  const save = () => {
    if (busy.current) return;
    const parsed = parseDraft(assumptions, sources, scenario);
    setErrors(parsed.ok ? {} : parsed.errors);
    setNotice(null);
    if (!parsed.ok) {
      setTimeout(() => summary.current?.focus(), 0);
      return;
    }
    if (version && !dirty) {
      setNotice(text.unchanged);
      return;
    }
    if (!begin()) return;
    if (id === null) {
      actions.create.mutate(parsed.body, {
        onSuccess: (created) => {
          busy.current = false;
          router.push(`/admin/estimator/${created.id}`);
        },
        onError: fail("save"),
      });
    } else {
      actions.save.mutate(parsed.body, {
        onSuccess: () => {
          busy.current = false;
          setNotice(text.saved);
        },
        onError: fail("save"),
      });
    }
  };

  const publish = () => {
    if (!begin()) return;
    actions.publish.mutate(undefined, {
      onSuccess: () => {
        busy.current = false;
        setNotice(format(text.publishedDone, { version: version?.version ?? "" }));
      },
      onError: fail("publish"),
    });
  };
  const archive = () => {
    if (!begin()) return;
    actions.archive.mutate(undefined, {
      onSuccess: () => {
        busy.current = false;
        setNotice(format(text.archivedDone, { version: version?.version ?? "" }));
      },
      onError: fail("archive"),
    });
  };

  const pending = actions.create.isPending || actions.save.isPending;
  const area = (key: "assumptions" | "sources", value: string, set: (next: string) => void, label: string, help: string) => (
    <CodeArea id={`f-${key}`} name={key} value={value} onChange={set} readOnly={!editable} error={errors[key]} label={label} help={help} />
  );

  return (
    <>
      <PageHeader eyebrow={text.editorEyebrow} title={version ? format(text.editorTitle, { version: version.version }) : text.newTitle} />
      {version ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={version.status === "published" ? "info" : "neutral"} data-status>
            {text.status[version.status] ?? version.status}
          </Badge>
          {version.is_archived ? (
            <Badge variant="neutral" icon={Archive}>
              {text.archived}
            </Badge>
          ) : null}
          <span className="font-medium text-ink" data-scenario>
            {text.scenarios[version.scenario] ?? version.scenario}
          </span>
        </div>
      ) : null}
      {prefilledFrom !== null ? (
        <Alert variant="info" role="note">
          <Info aria-hidden />
          <AlertDescription className="text-ink">{format(fromOther ? text.startedFromOther : text.prefilled, { version: prefilledFrom })}</AlertDescription>
        </Alert>
      ) : null}
      {version && !editable ? (
        <Alert variant="warning" role="note" data-read-only>
          <Lock aria-hidden />
          <AlertDescription className="text-ink">{format(text.readOnly, { state: version.is_archived ? text.archived.toLowerCase() : (text.status[version.status] ?? version.status).toLowerCase() })}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" role="status" data-notice>
          <CircleCheck aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {refused ? (
        <Alert variant="warning" role="alert" data-refused>
          <TriangleAlert aria-hidden />
          <AlertDescription>{refusalFor(fresh.data, refused)}</AlertDescription>
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
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {area("assumptions", assumptions, setAssumptions, text.assumptions, text.assumptionsHelp)}
        {area("sources", sources, setSources, text.sources, text.sourcesHelp)}
        {editable ? (
          <Button type="submit" size="lg" aria-disabled={pending} data-action="save">
            {pending ? text.saving : version ? text.save : text.create}
          </Button>
        ) : null}
      </form>
      {version && editable ? (
        <section className="space-y-3 rounded-card border-2 border-orange-text bg-surface p-5 shadow-e2" data-publish>
          {dirty ? (
            <p className="flex items-center gap-2 font-medium text-warning" data-unsaved>
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              {text.unsaved}
            </p>
          ) : null}
          <ConfirmAction
            id="publish"
            variant="default"
            label={text.publish}
            help={text.publishHelp}
            title={format(text.publishTitle, { version: version.version })}
            body={text.publishBody}
            yes={text.publishYes}
            keep={text.keep}
            disabled={actions.publish.isPending || dirty}
            onConfirm={publish}
          />
        </section>
      ) : null}
      {version && !version.is_archived ? (
        <section className="space-y-3 rounded-card border-2 border-dashed border-ink-3 bg-paper-2 p-5">
          <ConfirmAction
            id="archive"
            label={text.archive}
            help={text.archiveHelp}
            title={format(text.archiveTitle, { version: version.version })}
            body={text.archiveBody}
            yes={text.archiveYes}
            keep={text.keep}
            disabled={actions.archive.isPending}
            onConfirm={archive}
          />
        </section>
      ) : null}
    </>
  );
}

/** A code area for one of the two JSON documents: a monospace face, a "JSON" mark, its help under it and its error directly below with an icon, linked by aria-describedby; read-only versions are drawn flat. */
export function CodeArea({ id, name, value, onChange, readOnly, error, label, help }: { id: string; name: string; value: string; onChange: (next: string) => void; readOnly: boolean; error?: string; label: string; help: string }) {
  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-e1" data-code-area={name}>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="type-subheading text-ink">
          {label}
        </label>
        <Badge variant="neutral" icon={Braces}>
          {text.codeBadge}
        </Badge>
        {readOnly ? (
          <Badge variant="warning" icon={Lock}>
            {text.readOnlyBadge}
          </Badge>
        ) : null}
      </div>
      <p id={`${id}-help`} className="type-small text-ink-2">
        {help}
      </p>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        rows={12}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        className={cn("field-control w-full p-4 font-mono text-sm leading-6", readOnly ? "bg-paper-2" : "")}
      />
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-danger" data-error={name}>
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
