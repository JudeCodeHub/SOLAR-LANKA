import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import type { ApiError } from "@/lib/api/errors";

import { issueFieldPath } from "./errors";

/**
 * Put the backend's per-field validation issues onto the matching form fields. Issues that do
 * not belong to a field of this form are returned so they can still be shown, not dropped.
 */
export function applyApiIssues<TInput extends FieldValues, TOutput extends FieldValues>(
  form: UseFormReturn<TInput, unknown, TOutput>,
  error: ApiError,
): { mapped: number; unmapped: string[] } {
  const known = new Set(Object.keys(form.getValues()));
  let mapped = 0;
  const unmapped: string[] = [];
  for (const issue of error.issues) {
    const path = issueFieldPath(issue.location, known);
    if (path === null) {
      unmapped.push(issue.message);
    } else {
      form.setError(path as Path<TInput>, { type: "server", message: issue.message });
      mapped += 1;
    }
  }
  return { mapped, unmapped };
}
