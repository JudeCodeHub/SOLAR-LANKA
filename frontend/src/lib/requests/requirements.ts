/** Validation for a quotation request's requirements. */
import { z } from "zod";

import { messages } from "../../messages/index.ts";
import { isProductId } from "../catalogue/links.ts";
import { DISTRICTS } from "../directory/options.ts";
import { optionalDecimal } from "../estimator/schema.ts";

export const MAX_DETAILS = 4000;

const text = messages.estimator.validation;

export const requirementsSchema = z
  .object({
    estimate_id: z.string().refine((value) => value === "" || isProductId(value), {
      message: text.choose,
    }),
    district: z.string().refine((value) => (DISTRICTS as readonly string[]).includes(value), {
      message: text.choose,
    }),
    monthly_consumption_kwh: optionalDecimal(1_000_000, 3),
    details: z.string().trim().min(1).max(MAX_DETAILS),
  })
  .transform((value) => ({
    estimate_id: value.estimate_id === "" ? null : value.estimate_id,
    district: value.district as (typeof DISTRICTS)[number],
    monthly_consumption_kwh: value.monthly_consumption_kwh,
    details: value.details,
  }));

export type Requirements = z.output<typeof requirementsSchema>;

export const requirementsDefaults = {
  estimate_id: "",
  district: "",
  monthly_consumption_kwh: "",
  details: "",
} as const;

/** The form's text values for a draft that was already confirmed, so editing starts where it left off. */
export function valuesFromDraft(draft: Requirements): Record<keyof typeof requirementsDefaults, string> {
  return {
    estimate_id: draft.estimate_id ?? "",
    district: draft.district,
    monthly_consumption_kwh: draft.monthly_consumption_kwh ?? "",
    details: draft.details,
  };
}

/** The district a request must have when it is based on an estimate: the estimate's own. */
export function lockedDistrict(estimate: { inputs: { district: string } } | undefined): string | null {
  return estimate ? estimate.inputs.district : null;
}
