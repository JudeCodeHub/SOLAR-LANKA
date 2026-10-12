"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { ApiErrorMessage } from "@/components/api-error-message";
import { AppForm } from "@/components/forms/app-form";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { PageHeader } from "@/components/ui/page-header";
import { type ApiError, ensureApiError } from "@/lib/api/errors";
import { useAcceptInvite } from "@/lib/company/hooks";
import { useAppForm } from "@/lib/forms/use-app-form";
import { messages } from "@/messages";

const text = messages.joinCompany;
const schema = z.object({ code: z.string().trim().min(6, text.required).max(32) });

/** A signed-in person enters the invite code their company gave them and becomes its technician. */
export function JoinCompany() {
  const router = useRouter();
  const accept = useAcceptInvite();
  const [problem, setProblem] = useState<ApiError | null>(null);
  const form = useAppForm(schema, { defaultValues: { code: "" } });

  return (
    <div className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      {problem ? (problem.status === 404 ? <p role="alert" className="text-danger">{text.notValid}</p> : <ApiErrorMessage error={problem} />) : null}
      <AppForm
        form={form}
        className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6"
        onSubmit={async (values) => {
          setProblem(null);
          try {
            await accept.mutateAsync(values.code);
            // The refresh makes the shell read the new role for the sidebar and the technician area.
            router.push("/technician");
            router.refresh();
          } catch (error) {
            setProblem(ensureApiError(error));
          }
        }}
      >
        <TextField form={form} name="code" label={text.label} description={text.help} />
        <FormSubmitButton pending={form.formState.isSubmitting || accept.isPending}>{text.submit}</FormSubmitButton>
      </AppForm>
    </div>
  );
}
