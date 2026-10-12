"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { AppForm } from "@/components/forms/app-form";
import { CheckboxGroupField } from "@/components/forms/checkbox-group-field";
import { FormSubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { PageHeader } from "@/components/ui/page-header";
import { type ApiError, ensureApiError } from "@/lib/api/errors";
import { registerSchema } from "@/lib/company/profile";
import { useCreateCompany } from "@/lib/company/hooks";
import { DISTRICTS, SERVICES } from "@/lib/directory/options";
import { useAppForm } from "@/lib/forms/use-app-form";
import { serviceLabel } from "@/lib/landing/format";
import { messages } from "@/messages";

const text = messages.registerCompany;

/** A signed-in person creates their company as a private draft and goes to the company area to finish and submit it. */
export function RegisterCompany() {
  const router = useRouter();
  const create = useCreateCompany();
  const [problem, setProblem] = useState<ApiError | null>(null);
  const form = useAppForm(registerSchema, { defaultValues: { name: "", service_districts: [], services: [] } });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      {problem ? <ApiErrorMessage error={problem} /> : null}
      <AppForm
        form={form}
        className="space-y-6"
        onSubmit={async (values) => {
          setProblem(null);
          try {
            await create.mutateAsync(values);
            // The refresh makes the shell read the new role for the sidebar and the company area.
            router.push("/company");
            router.refresh();
          } catch (error) {
            setProblem(ensureApiError(error));
          }
        }}
      >
        <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
          <legend className="type-heading float-left mb-2 w-full text-ink">{text.title}</legend>
          <TextField form={form} name="name" label={text.name} description={text.nameHelp} />
          <CheckboxGroupField form={form} name="service_districts" legend={text.districts} description={text.districtsHelp} options={DISTRICTS.map((district) => ({ value: district, label: district }))} columns="sm:grid-cols-2 lg:grid-cols-3" />
          <CheckboxGroupField form={form} name="services" legend={text.services} description={text.servicesHelp} options={SERVICES.map((service) => ({ value: service, label: serviceLabel(service) }))} />
        </fieldset>
        <FormSubmitButton pending={form.formState.isSubmitting || create.isPending}>{text.submit}</FormSubmitButton>
      </AppForm>
    </div>
  );
}
