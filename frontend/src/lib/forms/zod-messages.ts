import { z } from "zod";

import { format, messages, plural } from "../../messages/index.ts";

const text = messages.forms.validation;

interface Issue {
  code: string;
  input?: unknown;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  expected?: string;
  format?: string;
}

/**
 * Wording for Zod's built-in checks, taken from the message catalog so form errors are
 * translatable and read the same as the backend's. Returns undefined for anything not covered,
 * which keeps Zod's own message, and custom messages written in a schema always win.
 */
export function zodMessage(issue: Issue): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) return text.required;
      return issue.expected === "number" ? text.number : text.invalid;
    case "too_small": {
      const min = Number(issue.minimum);
      if ((issue.origin === "string" || issue.origin === "array") && min <= 1) return text.required;
      if (issue.origin === "string") return format(plural(text.tooShort, min), { min });
      return format(text.tooSmall, { min });
    }
    case "too_big": {
      const max = Number(issue.maximum);
      return issue.origin === "string"
        ? format(plural(text.tooLong, max), { max })
        : format(text.tooBig, { max });
    }
    case "invalid_format":
      return issue.format === "email" ? text.email : text.invalid;
    default:
      return undefined;
  }
}

let installed = false;

/** Install the catalog wording for every schema. Safe to call more than once. */
export function installZodMessages(): void {
  if (installed) return;
  z.config({ customError: (issue) => zodMessage(issue as Issue) });
  installed = true;
}
