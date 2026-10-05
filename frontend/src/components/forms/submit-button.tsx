"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/** The submit button for AppForm. */
export function FormSubmitButton({
  children,
  pending,
}: {
  children: ReactNode;
  /** Pass form.formState.isSubmitting. */
  pending: boolean;
}) {
  return (
    <Button type="submit" loading={pending} data-pending={pending}>
      {pending ? messages.forms.saving : children}
    </Button>
  );
}
