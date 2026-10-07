"use client";

import { BadgeHelp, Building2, CircleCheck, TriangleAlert } from "lucide-react";

import { Table, TableRegion } from "@/components/ui/table";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";

import { ApiErrorMessage } from "@/components/api-error-message";
import { AppForm } from "@/components/forms/app-form";
import { CheckboxGroupField } from "@/components/forms/checkbox-group-field";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ApiError, ensureApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import {
  type CompanyProfile,
  useCompanyProfile,
  useCompanyReviews,
  useSubmitProfile,
  useUpdateProfile,
} from "@/lib/company/hooks";
import {
  canSubmit,
  completeness,
  hasChanges,
  MAX_CREDENTIALS,
  type ProfileUpdate,
  type ProfileValues,
  profileChanges,
  profileSchema,
  type PublicationStatus,
  savingEffect,
  valuesFromProfile,
} from "@/lib/company/profile";
import { DISTRICTS, SERVICES } from "@/lib/directory/options";
import { useAppForm } from "@/lib/forms/use-app-form";
import { serviceLabel } from "@/lib/landing/format";
import { format, messages, plural } from "@/messages";

const text = messages.company.profile;
const statusText: Record<string, { label: string; body: string }> = {
  draft: text.status.draft,
  pending: text.status.pending,
  approved: text.status.approved,
  rejected: text.status.rejected,
};
const outcomeText: Record<string, string> = text.history.outcomes;

/** One company's profile: status, editable details, submission for review, and review history. */
export function CompanyProfileEditor({ companyId, companyName }: { companyId: string; companyName: string }) {
  const query = useCompanyProfile(companyId);
  return (
    <>
      <p className="inline-flex min-h-8 w-fit items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink" data-company-name>
        <Building2 aria-hidden className="size-4 text-orange-text" />
        {companyName}
      </p>
      <QueryState query={query}>
        {(profile) => (
          <Editor
            profile={profile}
            refetch={query.refetch}
            refreshing={query.isRefetching}
          />
        )}
      </QueryState>
    </>
  );
}

function Editor({
  profile,
  refetch,
  refreshing,
}: {
  profile: CompanyProfile;
  refetch: () => Promise<{ data?: CompanyProfile }>;
  refreshing: boolean;
}) {
  const form = useAppForm(profileSchema, { defaultValues: valuesFromProfile(profile) });
  const credentials = useFieldArray({ control: form.control, name: "declared_credentials" });
  const current = useWatch({ control: form.control }) as ProfileValues;
  const update = useUpdateProfile(profile.id);
  const submit = useSubmitProfile(profile.id);
  const [confirm, setConfirm] = useState<{ changes: ProfileUpdate; status: PublicationStatus } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);

  const status = profile.publication_status;
  const dirty = hasChanges(profileChanges(profile, current));

  // A newer copy from the server.
  const lastServer = useRef(profile);
  useEffect(() => {
    const previous = lastServer.current;
    if (previous !== profile) {
      const unsaved = hasChanges(profileChanges(previous, form.getValues() as ProfileValues));
      if (!unsaved) form.reset(valuesFromProfile(profile));
      lastServer.current = profile;
    }
  }, [profile, form]);

  const save = async (changes: ProfileUpdate, from: PublicationStatus) => {
    const saved = await update.mutateAsync(changes);
    lastServer.current = saved;
    form.reset(valuesFromProfile(saved));
    setConfirm(null);
    setMessage(from === "draft" ? text.form.saved : text.form.savedReturned);
  };

  const confirmSave = async () => {
    if (inFlight.current || !confirm) return;
    inFlight.current = true;
    setProblem(null);
    try {
      await save(confirm.changes, confirm.status);
    } catch (error) {
      setConfirm(null);
      setProblem(ensureApiError(error));
    } finally {
      inFlight.current = false;
    }
  };

  const submitForReview = () => {
    // aria-disabled does not stop a click.
    if (inFlight.current || !canSubmit(status) || dirty) return;
    inFlight.current = true;
    setMessage(null);
    setStale(null);
    setProblem(null);
    submit.mutate(undefined, {
      onSuccess: () => setMessage(text.submit.done),
      onError: (error) => {
        if (error.status === 409) {
          // The status moved on since this page loaded: read it again and say what it is now.
          void refetch().then((fresh) => {
            const now = fresh.data?.publication_status;
            setStale(now === "pending" ? text.stale.pending : now === "approved" ? text.stale.approved : text.stale.other);
          });
        } else {
          setProblem(error);
        }
      },
      onSettled: () => {
        inFlight.current = false;
      },
    });
  };

  const info = completeness(profile);
  const statusInfo = statusText[status] ?? { label: status, body: "" };
  const effect = confirm ? savingEffect(confirm.status) : "none";

  return (
    <>
      <section aria-labelledby="status-title" className="space-y-3 rounded-card border-2 border-line bg-surface p-5 shadow-e1 sm:p-6">
        <h2 id="status-title" className="type-heading text-ink">
          {text.status.title}
        </h2>
        <p data-status={status}>
          <Badge variant={status === "approved" ? "success" : status === "pending" ? "info" : status === "rejected" ? "danger" : "neutral"}>{statusInfo.label}</Badge>
        </p>
        <p className="type-body text-ink">{statusInfo.body}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()} aria-disabled={refreshing}>
          {text.status.refresh}
        </Button>
      </section>

      {message ? (
        <Alert variant="success" role="status" data-message>
          <CircleCheck aria-hidden />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {stale ? (
        <Alert variant="warning" role="alert" data-stale>
          <TriangleAlert aria-hidden />
          <AlertDescription>{stale}</AlertDescription>
        </Alert>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}

      <AppForm
        form={form}
        className="space-y-6"
        onSubmit={async (values) => {
          setMessage(null);
          setStale(null);
          setProblem(null);
          // Decide from the status as it is now, not as it was when the page loaded.
          const fresh = (await refetch()).data ?? profile;
          const changes = profileChanges(fresh, values as ProfileValues);
          if (!hasChanges(changes)) {
            setMessage(text.form.nothing);
            return;
          }
          if (savingEffect(fresh.publication_status) !== "none") {
            setConfirm({ changes, status: fresh.publication_status });
            setTimeout(() => confirmRef.current?.focus(), 0);
            return;
          }
          await save(changes, fresh.publication_status);
        }}
      >
        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.form.title}</legend>
          <TextField form={form} name="name" label={text.form.name} description={text.form.nameHelp} />
          <CheckboxGroupField
            form={form}
            name="service_districts"
            legend={text.form.districts}
            description={text.form.districtsHelp}
            options={DISTRICTS.map((district) => ({ value: district, label: district }))}
            columns="sm:grid-cols-2 lg:grid-cols-3"
          />
          <CheckboxGroupField
            form={form}
            name="services"
            legend={text.form.services}
            description={text.form.servicesHelp}
            options={SERVICES.map((service) => ({ value: service, label: serviceLabel(service) }))}
          />
        </fieldset>

        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-credentials>
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.form.credentialsTitle}</legend>
          <p className="clear-both text-ink-2">{text.form.credentialsHelp}</p>
          <Badge variant="warning" icon={BadgeHelp} data-declared-badge>
            {messages.directory.credentials.badge}
          </Badge>
          {credentials.fields.length === 0 ? (
            <p className="type-body text-ink-2">{text.form.noCredentials}</p>
          ) : null}
          {credentials.fields.map((field, index) => (
            <fieldset key={field.id} className="space-y-3 rounded-card border border-dashed border-field-border bg-paper p-4" data-credential>
              <legend className="px-2 text-sm font-medium text-ink">{format(text.form.credentialNumber, { number: index + 1 })}</legend>
              <TextField form={form} name={`declared_credentials.${index}.name`} label={text.form.credentialName} />
              <TextField form={form} name={`declared_credentials.${index}.issuer`} label={text.form.credentialIssuer} />
              <Button
                type="button"
                variant="outline"
                aria-label={format(text.form.removeCredential, { number: index + 1 })}
                onClick={() => credentials.remove(index)}
              >
                {text.form.removeShort}
              </Button>
            </fieldset>
          ))}
          {credentials.fields.length < MAX_CREDENTIALS ? (
            <Button type="button" variant="outline" onClick={() => credentials.append({ name: "", issuer: "" })}>
              {text.form.addCredential}
            </Button>
          ) : null}
        </fieldset>

        {dirty ? (
          <p className="flex items-center gap-2 text-sm font-medium text-warning" data-unsaved>
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {text.form.unsaved}
          </p>
        ) : null}
        <FormSubmitButton pending={form.formState.isSubmitting || update.isPending}>{text.form.save}</FormSubmitButton>
      </AppForm>

      {confirm ? (
        <div role="group" aria-labelledby="confirm-title" className="space-y-3 rounded-card border-2 border-orange-text bg-orange-tint p-5 shadow-e2" data-confirm>
          <h3 id="confirm-title" ref={confirmRef} tabIndex={-1} className="type-subheading text-ink outline-none">
            {text.confirm.title}
          </h3>
          <p className="type-body text-ink">{effect === "none" ? "" : text.confirm[effect]}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void confirmSave()} aria-disabled={update.isPending} data-confirm-yes>
              {text.confirm.yes}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              {text.confirm.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="submit-title" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
        <h2 id="submit-title" className="type-heading text-ink">
          {text.submit.title}
        </h2>
        <p className="type-small text-ink-2">{text.submit.intro}</p>
        <h3 className="font-medium text-ink">{text.submit.checklist}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink" data-checklist>
          <li>
            {info.districts === 0 ? text.submit.districtsNone : format(plural(text.submit.districts, info.districts), { count: info.districts })}
          </li>
          <li>{info.services === 0 ? text.submit.servicesNone : format(text.submit.services, { count: info.services })}</li>
          <li>{info.installation ? text.submit.installationYes : text.submit.installationNo}</li>
          <li>{format(text.submit.credentials, { count: info.credentials })}</li>
        </ul>
        {!canSubmit(status) ? (
          <p className="text-sm font-medium text-ink" data-cannot-submit>
            {text.submit.notNow}
          </p>
        ) : dirty ? (
          <p className="text-sm font-medium text-warning" data-save-first>
            {text.submit.saveFirst}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={submitForReview}
          aria-disabled={!canSubmit(status) || dirty || submit.isPending}
          data-submit
        >
          {submit.isPending ? text.submit.working : text.submit.button}
        </Button>
      </section>

      <History id={profile.id} />
    </>
  );
}

function History({ id }: { id: string }) {
  const query = useCompanyReviews(id);
  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <h2 id="history-title" className="type-heading text-ink">
        {text.history.title}
      </h2>
      <QueryState
        query={query}
        isEmpty={(entries) => entries.length === 0}
        empty={<p className="type-body text-ink-2">{text.history.empty}</p>}
      >
        {(entries) => (
          <TableRegion label={text.history.caption}>
          <Table className="w-full text-sm" data-history>
            <caption className="sr-only">{text.history.caption}</caption>
            <thead>
              <tr className="text-left">
                <th scope="col">
                  {text.history.date}
                </th>
                <th scope="col">
                  {text.history.event}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row" className="text-left font-normal">
                    {formatLongDate(entry.created_at) ?? entry.created_at}
                  </th>
                  <td>{outcomeText[entry.outcome] ?? entry.outcome}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          </TableRegion>
        )}
      </QueryState>
    </section>
  );
}
