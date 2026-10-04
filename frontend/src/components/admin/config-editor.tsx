"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PlatformGate } from "@/components/admin/platform-gate";
import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { useConfigActions, useConfigVersion, useConfigVersions } from "@/lib/admin/hooks";
import { DEFAULT_SCENARIO, parseDraft, pretty, refusalFor, SCENARIOS, type Scenario, sameJson } from "@/lib/admin/config";
import { format, messages } from "@/messages";

const text = messages.adminEstimator;

/** Edit a draft estimator version, or start one from the newest; publish or archive with confirmation. */
export function ConfigEditor({ id }: { id: string | null }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <Link href="/admin/estimator" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
        {text.back}
      </Link>
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
          <div className="space-y-1">
            <label htmlFor="f-scenario" className="block font-medium">
              {text.scenarioLabel}
            </label>
            <select id="f-scenario" value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)} className="min-h-11 w-full rounded-lg border bg-transparent px-3 text-sm">
              {SCENARIOS.map((name) => (
                <option key={name} value={name}>
                  {text.scenarios[name]}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{text.scenarioHelp}</p>
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
    <div className="space-y-1">
      <label htmlFor={`f-${key}`} className="block font-medium">
        {label}
      </label>
      <textarea
        id={`f-${key}`}
        value={value}
        onChange={(event) => set(event.target.value)}
        readOnly={!editable}
        rows={12}
        spellCheck={false}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={`f-${key}-help${errors[key] ? ` f-${key}-error` : ""}`}
        className="w-full rounded-lg border bg-transparent p-3 font-mono text-sm"
      />
      <p id={`f-${key}-help`} className="text-sm text-muted-foreground">
        {help}
      </p>
      {errors[key] ? (
        <p id={`f-${key}-error`} className="text-sm font-medium text-destructive" data-error={key}>
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{version ? format(text.editorTitle, { version: version.version }) : text.newTitle}</h1>
      {version ? (
        <p className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border px-2 py-0.5 text-xs" data-status>
            {text.status[version.status] ?? version.status}
          </span>
          {version.is_archived ? <span className="rounded-full border px-2 py-0.5 text-xs">{text.archived}</span> : null}
        </p>
      ) : null}
      {version ? (
        <p className="text-sm text-muted-foreground" data-scenario>
          {text.scenarios[version.scenario] ?? version.scenario}
        </p>
      ) : null}
      {prefilledFrom !== null ? <p className="text-sm text-muted-foreground">{format(fromOther ? text.startedFromOther : text.prefilled, { version: prefilledFrom })}</p> : null}
      {version && !editable ? (
        <p className="text-sm" data-read-only>
          {format(text.readOnly, { state: version.is_archived ? text.archived.toLowerCase() : (text.status[version.status] ?? version.status).toLowerCase() })}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm font-medium" data-notice>
          {notice}
        </p>
      ) : null}
      {refused ? (
        <p role="alert" className="text-sm font-medium" data-refused>
          {refusalFor(fresh.data, refused)}
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
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {area("assumptions", assumptions, setAssumptions, text.assumptions, text.assumptionsHelp)}
        {area("sources", sources, setSources, text.sources, text.sourcesHelp)}
        {editable ? (
          <Button type="submit" aria-disabled={pending} data-action="save">
            {pending ? text.saving : version ? text.save : text.create}
          </Button>
        ) : null}
      </form>
      {version && editable ? (
        <section className="space-y-2" data-publish>
          {dirty ? (
            <p className="text-sm" data-unsaved>
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
        <section className="space-y-2">
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
