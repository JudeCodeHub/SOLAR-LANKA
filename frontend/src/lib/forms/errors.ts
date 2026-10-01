/** Pure helpers that connect validation errors to the form UI. */
import type { FieldErrors, FieldValues } from "react-hook-form";

export interface FieldProblem {
  /** Dotted field path, as used by react-hook-form: "email", "items.0.quantity". */
  name: string;
  message: string;
}

/** Flatten react-hook-form's nested error object into a list in field order. */
export function collectFieldProblems(errors: FieldErrors<FieldValues>): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const visit = (node: unknown, path: string) => {
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    if (typeof record.message === "string" && record.message !== "" && "type" in record) {
      problems.push({ name: path, message: record.message });
      return;
    }
    for (const [key, value] of Object.entries(record)) {
      // "ref" is the DOM element attached to a leaf error; never descend into it.
      if (key === "ref") continue;
      visit(value, path === "" ? key : `${path}.${key}`);
    }
  };
  visit(errors, "");
  return problems;
}

/** A stable DOM id for a field, unique per form instance. */
export function fieldId(formId: string, name: string): string {
  return `${formId}-${name.replaceAll(".", "-")}`;
}

/** Map a backend validation issue location. */
export function issueFieldPath(
  location: readonly (string | number)[] | undefined,
  knownFields: ReadonlySet<string>,
): string | null {
  if (!location || location.length === 0) return null;
  const parts = location[0] === "body" ? location.slice(1) : location;
  const first = parts[0];
  if (typeof first !== "string" || !knownFields.has(first)) return null;
  return parts.join(".");
}
