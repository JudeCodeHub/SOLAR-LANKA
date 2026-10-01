/**
 * Validation for the estimator form. Everything the visitor types is text; this turns it into the
 * exact request the backend expects. Optional fields left blank become null (unknown), never 0,
 * and a typed 0 stays 0. Numbers are sent as the text the visitor entered (trimmed), so no
 * precision is lost to floating point. The backend still validates everything again.
 */
import { z } from "zod";

import { format, messages, plural } from "../../messages/index.ts";
import { DISTRICTS } from "../directory/options.ts";
import {
  BACKUP_CHOICES,
  DEFAULT_SCENARIO,
  SCHEMES,
  SYSTEM_TYPES,
  unsupportedParts,
} from "./scenario.ts";

const text = messages.estimator;
const SHADING = ["none", "partial", "heavy"] as const;

/** A plain non-negative decimal within a maximum and a number of decimal places. */
export function decimal(maxValue: number, places: number) {
  return z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (value === "") {
        context.addIssue({ code: "custom", message: messages.forms.validation.required });
        return;
      }
      if (!/^\d+(\.\d+)?$/.test(value) || value.length > 16) {
        context.addIssue({ code: "custom", message: text.validation.decimal });
        return;
      }
      const decimals = value.split(".")[1]?.length ?? 0;
      if (decimals > places) {
        context.addIssue({
          code: "custom",
          message: format(plural(text.validation.places, places), { max: places }),
        });
        return;
      }
      if (Number(value) > maxValue) {
        context.addIssue({
          code: "custom",
          message: format(messages.forms.validation.tooBig, { max: maxValue.toLocaleString("en") }),
        });
      }
    });
}

/** Blank means unknown (null); anything else must be a valid value. */
export function optionalDecimal(maxValue: number, places: number) {
  const inner = decimal(maxValue, places);
  return z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;
      const result = inner.safeParse(value);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({ code: "custom", message: issue.message });
        }
        return z.NEVER;
      }
      return result.data;
    });
}

const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.string().refine((value) => (values as readonly string[]).includes(value), {
    message: text.validation.choose,
  }) as unknown as z.ZodType<T[number], string>;

export const estimatorSchema = z
  .object({
    monthly_consumption_kwh: decimal(1_000_000, 3),
    district: z.string().refine((value) => (DISTRICTS as readonly string[]).includes(value), {
      message: text.validation.choose,
    }),
    usable_roof_area_m2: decimal(1_000_000, 2),
    shading_condition: z.enum(["", ...SHADING]),
    daytime_consumption_percent: optionalDecimal(100, 2),
    monthly_bill_lkr: optionalDecimal(1_000_000_000, 2),
    connection_scheme: choice(SCHEMES),
    system_type: choice(SYSTEM_TYPES),
    backup: choice(BACKUP_CHOICES),
  })
  .superRefine((value, context) => {
    // The same rules the guidance panel explains; refuse here so nothing unsupported is sent.
    const messageFor = {
      scheme: ["connection_scheme", text.unsupported.schemeField],
      systemType: ["system_type", text.unsupported.systemTypeField],
      backup: ["backup", text.unsupported.backupField],
    } as const;
    for (const problem of unsupportedParts(value)) {
      const [path, message] = messageFor[problem];
      context.addIssue({ code: "custom", path: [path], message });
    }
  })
  .transform((value) => ({
    monthly_consumption_kwh: value.monthly_consumption_kwh,
    district: value.district as (typeof DISTRICTS)[number],
    usable_roof_area_m2: value.usable_roof_area_m2,
    shading_condition: value.shading_condition === "" ? null : value.shading_condition,
    daytime_consumption_percent: value.daytime_consumption_percent,
    monthly_bill_lkr: value.monthly_bill_lkr,
    connection_scheme: "net_metering" as const,
    system_type: "on_grid" as const,
    backup_required: false as const,
  }));

export const estimatorDefaults = {
  monthly_consumption_kwh: "",
  district: "",
  usable_roof_area_m2: "",
  shading_condition: "",
  daytime_consumption_percent: "",
  monthly_bill_lkr: "",
  connection_scheme: DEFAULT_SCENARIO.connection_scheme,
  system_type: DEFAULT_SCENARIO.system_type,
  backup: DEFAULT_SCENARIO.backup,
} as const;
