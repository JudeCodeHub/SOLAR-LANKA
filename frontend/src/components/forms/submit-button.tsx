"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/**
 * The submit button for AppForm. While saving it stays focusable (aria-disabled, not disabled)
 * so keyboard focus is not thrown away mid-submit; AppForm ignores repeat submits.
 */
export function FormSubmitButton({
  children,
  pending,
}: {
  children: ReactNode;
  /** Pass form.formState.isSubmitting. */
  pending: boolean;
}) {
  return (
    <Button type="submit" aria-disabled={pending} data-pending={pending} className="aria-disabled:opacity-70">
      {pending ? messages.forms.saving : children}
    </Button>
  );
}
